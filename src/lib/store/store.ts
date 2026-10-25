/**
 * The device store: one durable, ordered event log + the last server snapshot, folded with the shared
 * reducer into what the UI shows. Actions are written to IndexedDB before they are reported, so a closed
 * app, a reboot or airplane mode never loses a clock-in. Sync pushes the log in order and replaces the
 * snapshot with the server's truth; a refused event stays visible under "Needs attention" — nothing is
 * ever silently overwritten or dropped.
 */
import { captureLocation, type CaptureOptions, type CaptureResult } from "@/lib/geo/capture";
import {
  breakEndEvent,
  breakStartEvent,
  clockInEvent,
  clockOutEvent,
  correctEvent,
  locationEvent,
  manualCreateEvent,
  simpleEvent,
  type CorrectionInput,
  type EventContext,
} from "@/lib/shifts/events";
import { safetyClockOutId, safetyLimitReachedAt } from "@/lib/shifts/nudges";
import {
  defaultCompanion,
  defaultSettings,
  type Activity,
  type Companion,
  type EarnedAchievement,
  type LedgerEntry,
  type Place,
  type ProfileState,
  type Project,
  type Settings,
} from "@/lib/shifts/profile";
import { applyEvent, foldEvents } from "@/lib/shifts/reducer";
import {
  EMPTY_STATE,
  activeSession,
  type BreakKind,
  type SessionDetails,
  type ShiftBreak,
  type ShiftError,
  type ShiftEvent,
  type ShiftSession,
  type ShiftState,
} from "@/lib/shifts/types";
import { deviceTimeZone } from "@/lib/time/zone";
import type { ProfileDocument, PushResult } from "@/lib/sync/contract";
import { SyncHttpError, type SyncTransport } from "@/lib/sync/transport";

import { DEFAULT_META, type Meta, type Persistence, type StoredEvent } from "./persistence";

/** device: no account here · account: syncing to an account · signed_out: was attached, needs sign-in again ·
 * unconfigured: this deployment has no sync · attach_pending: signed in, device data not yet uploaded ·
 * foreign_data: signed in as someone other than this device's data owner. */
export type SyncMode = "device" | "account" | "signed_out" | "unconfigured" | "attach_pending" | "foreign_data";
export type SessionSyncState = "local" | "syncing" | "attention" | "synced";

export interface SyncView {
  mode: SyncMode;
  phase: "idle" | "syncing" | "offline" | "error";
  message: string | null;
  /** Events not yet accepted by the server (or, in device mode, kept only here). */
  pending: number;
  attention: StoredEvent[];
  lastSyncedAt: number | null;
  email: string | null;
}

export interface StoreView {
  ready: boolean;
  loadError: string | null;
  state: ShiftState;
  /** Visible sessions, newest first. */
  sessions: ShiftSession[];
  trash: ShiftSession[];
  active: ShiftSession | null;
  profile: ProfileState;
  sync: SyncView;
  sessionSync: Record<string, SessionSyncState>;
  serverOffsetMs: number;
  dismissedNudges: ReadonlySet<string>;
  /** The clock-out that can still be undone. */
  undo: { eventId: string; sessionId: string; until: number } | null;
  /** Demo history in memory only (`?demo=1`): nothing is saved or synced. */
  demo: boolean;
}

export class ShiftActionError extends Error {
  constructor(readonly error: ShiftError) {
    super(error.message);
  }
}

export interface StoreDeps {
  persistence: Persistence;
  transport: SyncTransport | null;
  clock?: () => number;
  deviceTimeZone?: () => string;
  newId?: () => string;
  locate?: (opts: CaptureOptions) => Promise<CaptureResult>;
  online?: () => boolean;
  /** Undo window after clock-out (A08). */
  undoMs?: number;
  demo?: boolean;
  /** Turns the view into reward ledger rows / achievements to append (wired to src/lib/rewards). */
  derive?: (view: StoreView, now: number) => { ledger: LedgerEntry[]; achievements: EarnedAchievement[]; highestLevel: number } | null;
}

export function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const MAX_BATCH = 100;

function emptyProfile(zone: string, now: number): ProfileState {
  return { settings: defaultSettings(zone, now), projects: [], places: [], activities: [], companion: defaultCompanion(now), ledger: [], achievements: [] };
}

function byKey<T>(rows: readonly T[], key: (r: T) => string, newer?: (a: T, b: T) => boolean): T[] {
  const map = new Map<string, T>();
  for (const r of rows) {
    const k = key(r);
    const prev = map.get(k);
    if (!prev || (newer && newer(r, prev))) map.set(k, r);
  }
  return [...map.values()];
}

/** Last write wins per document / row; append-only parts union by key. */
export function mergeProfile(local: ProfileState, remote: ProfileDocument): ProfileState {
  const newer = (a: { updatedAt: number }, b: { updatedAt: number }) => a.updatedAt > b.updatedAt;
  return {
    settings: remote.settings && remote.settings.updatedAt > local.settings.updatedAt ? remote.settings : local.settings,
    companion:
      remote.companion && remote.companion.updatedAt > local.companion.updatedAt
        ? { ...remote.companion, highestLevel: Math.max(remote.companion.highestLevel, local.companion.highestLevel), unlocked: [...new Set([...remote.companion.unlocked, ...local.companion.unlocked])] }
        : { ...local.companion, highestLevel: Math.max(remote.companion?.highestLevel ?? 1, local.companion.highestLevel) },
    projects: byKey([...local.projects, ...remote.projects], (p) => p.id, newer),
    places: byKey([...local.places, ...remote.places], (p) => p.id, newer),
    activities: byKey([...local.activities, ...remote.activities], (a) => a.id),
    ledger: byKey([...local.ledger, ...remote.ledger], (l) => l.key).sort((a, b) => a.at - b.at || a.key.localeCompare(b.key)),
    achievements: byKey([...local.achievements, ...remote.achievements], (a) => a.code, (a, b) => a.earnedAt < b.earnedAt),
  };
}

export class ShiftStore {
  private events: StoredEvent[] = [];
  private base: ShiftState = EMPTY_STATE;
  private profile: ProfileState;
  private meta: Meta = { ...DEFAULT_META };
  private listeners = new Set<() => void>();
  private view: StoreView;
  private seq = 0;
  private ready = false;
  private loadError: string | null = null;
  private mode: SyncMode = "device";
  private phase: SyncView["phase"] = "idle";
  private message: string | null = null;
  private email: string | null = null;
  private serverUserId: string | null = null;
  private syncing: Promise<void> | null = null;
  private syncAgain = false;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private undo: StoreView["undo"] = null;
  private undoTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffUntil = 0;
  private failures = 0;
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: StoreDeps) {
    this.profile = emptyProfile(this.zone(), 0);
    this.view = this.buildView();
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  async init(): Promise<void> {
    try {
      const snap = await this.deps.persistence.load();
      this.events = snap.events.sort((a, b) => a.seq - b.seq);
      // A send interrupted by a closed app never got its answer: it is simply local again (ids make resends safe).
      for (const e of this.events) if (e.status === "syncing") e.status = "local";
      this.seq = this.events.reduce((m, e) => Math.max(m, e.seq), 0);
      this.base = { sessions: Object.fromEntries(snap.base.map((s) => [s.id, s])) };
      this.meta = { ...DEFAULT_META, ...snap.meta };
      this.profile = snap.profile ?? emptyProfile(this.zone(), this.now());
      this.mode = this.meta.owner === "device" ? "device" : "account";
    } catch (error) {
      this.loadError = (error as Error).message || "This browser blocked storage.";
    }
    this.ready = true;
    this.recompute();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.view;

  /** Authoritative now: the device clock corrected by the last measured server offset. */
  now(): number {
    return (this.deps.clock ?? Date.now)() + this.meta.serverOffsetMs;
  }

  private zone() {
    return (this.deps.deviceTimeZone ?? deviceTimeZone)();
  }

  private ctx(): EventContext {
    return { now: this.now(), deviceTimeZone: this.zone(), newId: this.deps.newId ?? newUuid };
  }

  private persist<T>(write: () => Promise<T>): Promise<T> {
    // Serialized so writes land in the order they were made.
    const next = this.writeChain.then(write, write);
    this.writeChain = next.catch(() => undefined);
    return next;
  }

  // ─── Folding ──────────────────────────────────────────────────────────────
  private recompute() {
    const pending = this.events.filter((e) => e.status !== "rejected");
    const { state, rejected } = foldEvents(
      pending.map((e) => e.event),
      this.base,
    );
    if (rejected.length > 0) {
      // Valid when recorded, but the server's newer truth no longer allows it (e.g. another device).
      const ids = new Set(rejected.map((r) => r.event.id));
      const changed: StoredEvent[] = [];
      for (const e of this.events) {
        if (ids.has(e.event.id)) {
          e.status = "rejected";
          e.error = rejected.find((r) => r.event.id === e.event.id)!.error;
          changed.push(e);
        }
      }
      void this.persist(() => this.deps.persistence.putEvents(changed));
    }
    this.view = this.buildView(state);
    this.listeners.forEach((l) => l());
    this.applyDerived();
  }

  private buildView(state: ShiftState = EMPTY_STATE): StoreView {
    const all = Object.values(state.sessions);
    const sessionSync: Record<string, SessionSyncState> = {};
    const rank: Record<SessionSyncState, number> = { synced: 0, local: 1, syncing: 2, attention: 3 };
    for (const e of this.events) {
      const s: SessionSyncState = e.status === "rejected" ? "attention" : e.status;
      const prev = sessionSync[e.event.sessionId];
      if (!prev || rank[s] > rank[prev]) sessionSync[e.event.sessionId] = s;
    }
    return {
      ready: this.ready,
      loadError: this.loadError,
      state,
      sessions: all.filter((s) => s.deletedAt === null).sort((a, b) => b.startedAt - a.startedAt),
      trash: all.filter((s) => s.deletedAt !== null).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)),
      active: activeSession(state),
      profile: this.profile,
      sync: {
        mode: this.mode,
        phase: this.phase,
        message: this.message,
        pending: this.events.filter((e) => e.status !== "rejected").length,
        attention: this.events.filter((e) => e.status === "rejected"),
        lastSyncedAt: this.meta.lastSyncedAt,
        email: this.email,
      },
      sessionSync,
      serverOffsetMs: this.meta.serverOffsetMs,
      dismissedNudges: new Set(this.meta.dismissedNudges),
      undo: this.undo,
      demo: this.deps.demo ?? false,
    };
  }

  private applyDerived() {
    const derived = this.deps.derive?.(this.view, this.now());
    if (!derived) return;
    const { ledger, achievements, highestLevel } = derived;
    if (ledger.length === 0 && achievements.length === 0 && highestLevel <= this.profile.companion.highestLevel) return;
    this.profile = {
      ...this.profile,
      ledger: [...this.profile.ledger, ...ledger],
      achievements: [...this.profile.achievements, ...achievements],
      companion: { ...this.profile.companion, highestLevel: Math.max(highestLevel, this.profile.companion.highestLevel) },
    };
    this.meta = { ...this.meta, profileDirty: true };
    void this.persist(() => this.deps.persistence.putProfile(this.profile));
    void this.persist(() => this.deps.persistence.putMeta(this.meta));
    this.view = { ...this.view, profile: this.profile };
    this.listeners.forEach((l) => l());
    this.scheduleSync();
  }

  // ─── Recording ────────────────────────────────────────────────────────────
  /** Validates against what the person sees, stores durably, then shows it. Throws ShiftActionError. */
  async record(event: ShiftEvent, opts: { holdMs?: number } = {}): Promise<ShiftSession | null> {
    const result = applyEvent(this.view.state, event);
    if (!result.ok) throw new ShiftActionError(result.error);
    const stored: StoredEvent = {
      event,
      seq: ++this.seq,
      status: "local",
      holdUntil: opts.holdMs ? this.now() + opts.holdMs : null,
      error: null,
      attempts: 0,
    };
    await this.persist(() => this.deps.persistence.putEvent(stored));
    this.events.push(stored);
    this.recompute();
    this.scheduleSync(opts.holdMs ? opts.holdMs + 200 : 300);
    return result.session;
  }

  async clockIn(details: SessionDetails & { goalSeconds?: number } = {}): Promise<ShiftSession> {
    const { goalSeconds, ...rest } = details;
    const s = this.profile.settings;
    const event = clockInEvent(this.ctx(), {
      goalSeconds: goalSeconds ?? s.defaultGoalSeconds,
      reportingTimeZone: s.reportingTimeZone,
      payRateMinor: s.payTracking ? s.defaultPayRateMinor : null,
      currency: s.payTracking ? s.currency : null,
      ...rest,
    });
    const session = (await this.record(event))!;
    if (s.locationOnClockIn) void this.captureFor(session.id, "clock_in", event.at);
    else void this.recordFix(session.id, { event: "clock_in", status: "off", requestedAt: event.at, capturedAt: null, latitude: null, longitude: null, accuracyM: null, placeLabel: null });
    return session;
  }

  async startBreak(kind: BreakKind = "rest") {
    const active = this.requireActive();
    return this.record(breakStartEvent(this.ctx(), active.id, kind));
  }

  async endBreak() {
    const active = this.requireActive();
    const open = active.breaks.find((b) => b.endedAt === null);
    if (!open) throw new ShiftActionError({ code: "invalid_state", message: "No break is running." });
    return this.record(breakEndEvent(this.ctx(), active.id, open.id));
  }

  /** Ends the running session now. The end time is the tap time; it can be undone for a few seconds. */
  async clockOut(): Promise<ShiftSession | null> {
    const active = this.requireActive();
    const holdMs = this.deps.undoMs ?? 8_000;
    const event = clockOutEvent(this.ctx(), active.id);
    const session = await this.record(event, { holdMs });
    this.setUndo({ eventId: event.id, sessionId: active.id, until: this.now() + holdMs }, holdMs, () => {
      if (this.profile.settings.locationOnClockOut) void this.captureFor(active.id, "clock_out", event.at);
    });
    return session;
  }

  /** Removes the clock-out while its undo window is open and it hasn't been sent. */
  async undoClockOut(): Promise<boolean> {
    const undo = this.undo;
    if (!undo || this.now() > undo.until) return false;
    const stored = this.events.find((e) => e.event.id === undo.eventId);
    if (!stored || stored.status !== "local") return false;
    await this.persist(() => this.deps.persistence.deleteEvents([undo.eventId]));
    this.events = this.events.filter((e) => e !== stored);
    this.setUndo(null);
    this.recompute();
    return true;
  }

  private setUndo(undo: StoreView["undo"], ms = 0, onExpire?: () => void) {
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undoTimer = null;
    this.undo = undo;
    if (undo) {
      this.undoTimer = setTimeout(() => {
        this.undo = null;
        this.recompute();
        onExpire?.();
      }, ms);
    }
  }

  private requireActive(): ShiftSession {
    const active = this.view.active;
    if (!active) throw new ShiftActionError({ code: "invalid_state", message: "No session is running." });
    return active;
  }

  async retryLocation(sessionId: string) {
    return this.captureFor(sessionId, "retry", this.now());
  }

  private async captureFor(sessionId: string, event: "clock_in" | "clock_out" | "retry", requestedAt: number) {
    const fix = await (this.deps.locate ?? captureLocation)({ event, requestedAt, places: this.profile.places });
    return this.recordFix(sessionId, fix);
  }

  private async recordFix(sessionId: string, fix: CaptureResult) {
    try {
      await this.record(locationEvent(this.ctx(), sessionId, fix));
    } catch {
      // The session was deleted meanwhile: nothing to attach to.
    }
  }

  correct(sessionId: string, input: CorrectionInput) {
    return this.record(correctEvent(this.ctx(), sessionId, input));
  }

  annotate(sessionId: string, changes: Extract<ShiftEvent, { type: "annotate" }>["changes"]) {
    const ctx = this.ctx();
    return this.record({ id: ctx.newId!(), at: ctx.now, recordedAt: ctx.now, deviceTimeZone: ctx.deviceTimeZone, type: "annotate", sessionId, changes });
  }

  manualCreate(input: { startedAt: number; endedAt: number; breaks: ShiftBreak[]; goalSeconds?: number; reportingTimeZone?: string; allowOverlap?: boolean } & SessionDetails) {
    const s = this.profile.settings;
    return this.record(
      manualCreateEvent(this.ctx(), {
        ...input,
        goalSeconds: input.goalSeconds ?? s.defaultGoalSeconds,
        reportingTimeZone: input.reportingTimeZone ?? s.reportingTimeZone,
      }),
    );
  }

  rezone(sessionId: string, reportingTimeZone: string, expectedRevision: number) {
    const ctx = this.ctx();
    return this.record({ id: ctx.newId!(), at: ctx.now, recordedAt: ctx.now, deviceTimeZone: ctx.deviceTimeZone, type: "rezone", sessionId, reportingTimeZone, expectedRevision });
  }

  trash(sessionId: string) {
    return this.record(simpleEvent(this.ctx(), "delete", sessionId));
  }
  restore(sessionId: string) {
    return this.record(simpleEvent(this.ctx(), "restore", sessionId));
  }
  purge(sessionId: string) {
    return this.record(simpleEvent(this.ctx(), "purge", sessionId));
  }

  deleteLocation(sessionId: string, fixId: string) {
    const ctx = this.ctx();
    return this.record({ id: ctx.newId!(), at: ctx.now, recordedAt: ctx.now, deviceTimeZone: ctx.deviceTimeZone, type: "location_delete", sessionId, fixId });
  }

  /** Deletes every captured location point (privacy centre), one event per fix. */
  async deleteAllLocations(before?: number) {
    for (const s of Object.values(this.view.state.sessions)) {
      for (const fix of s.locations) {
        if (fix.status === "captured" && (before === undefined || (fix.capturedAt ?? fix.requestedAt) < before)) await this.deleteLocation(s.id, fix.id);
      }
    }
  }

  /** Applies location retention (settings) — call on app open. */
  async applyRetention() {
    const days = this.profile.settings.locationRetentionDays;
    if (days === null) return;
    await this.deleteAllLocations(this.now() - days * 86_400_000);
  }

  /** Opt-in safety limit: clocks out at the exact instant the limit was reached, with a shared id. */
  async checkSafetyLimit(): Promise<boolean> {
    const active = this.view.active;
    if (!active) return false;
    const reachedAt = safetyLimitReachedAt(active, this.profile.settings.safetyLimitHours, this.now());
    if (reachedAt === null) return false;
    const ctx = this.ctx();
    const id = safetyClockOutId(active.id);
    if (this.events.some((e) => e.event.id === id)) return false;
    try {
      await this.record({ id, at: reachedAt, recordedAt: ctx.now, deviceTimeZone: ctx.deviceTimeZone, type: "clock_out", sessionId: active.id });
      return true;
    } catch {
      return false;
    }
  }

  /** Throws away a refused event (the person chose to discard it). Dependent events re-fold. */
  async discard(eventId: string) {
    const target = this.events.find((e) => e.event.id === eventId);
    if (!target) return;
    // Discarding the event that created a session discards that session's other device-only events too.
    const creates = target.event.type === "clock_in" || target.event.type === "manual_create";
    const drop = this.events.filter((e) => e === target || (creates && e.event.sessionId === target.event.sessionId && e.status !== "syncing"));
    const ids = drop.map((e) => e.event.id);
    await this.persist(() => this.deps.persistence.deleteEvents(ids));
    this.events = this.events.filter((e) => !drop.includes(e));
    for (const e of this.events) if (e.status === "rejected") e.status = "local";
    this.recompute();
    this.scheduleSync();
  }

  /** Sends a refused event again (e.g. after the conflicting session was fixed). */
  async retry(eventId: string) {
    const e = this.events.find((x) => x.event.id === eventId);
    if (!e) return;
    e.status = "local";
    e.error = null;
    await this.persist(() => this.deps.persistence.putEvent(e));
    this.recompute();
    this.scheduleSync(0);
  }

  // ─── Profile ──────────────────────────────────────────────────────────────
  private async saveProfile(next: ProfileState) {
    this.profile = next;
    this.meta = { ...this.meta, profileDirty: true };
    await this.persist(() => this.deps.persistence.putProfile(next));
    await this.persist(() => this.deps.persistence.putMeta(this.meta));
    this.recompute();
    this.scheduleSync();
  }

  updateSettings(patch: Partial<Omit<Settings, "updatedAt">>) {
    return this.saveProfile({ ...this.profile, settings: { ...this.profile.settings, ...patch, updatedAt: this.now() } });
  }

  updateCompanion(patch: Partial<Omit<Companion, "updatedAt" | "highestLevel">>) {
    return this.saveProfile({ ...this.profile, companion: { ...this.profile.companion, ...patch, updatedAt: this.now() } });
  }

  saveProject(project: Omit<Project, "updatedAt">) {
    const row = { ...project, updatedAt: this.now() };
    return this.saveProfile({ ...this.profile, projects: [...this.profile.projects.filter((p) => p.id !== row.id), row] });
  }

  savePlace(place: Omit<Place, "updatedAt">) {
    const row = { ...place, updatedAt: this.now() };
    return this.saveProfile({ ...this.profile, places: [...this.profile.places.filter((p) => p.id !== row.id), row] });
  }

  removePlace(id: string) {
    return this.saveProfile({ ...this.profile, places: this.profile.places.filter((p) => p.id !== id) });
  }

  addActivity(activity: Omit<Activity, "at">) {
    if (this.profile.activities.some((a) => a.id === activity.id)) return Promise.resolve();
    return this.saveProfile({ ...this.profile, activities: [...this.profile.activities, { ...activity, at: this.now() }] });
  }

  async dismissNudge(id: string) {
    this.meta = { ...this.meta, dismissedNudges: [...this.meta.dismissedNudges.slice(-200), id] };
    await this.persist(() => this.deps.persistence.putMeta(this.meta));
    this.recompute();
  }

  // ─── Sync ─────────────────────────────────────────────────────────────────
  scheduleSync(delayMs = 300) {
    if (!this.deps.transport) return;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => void this.syncNow(), Math.max(delayMs, this.backoffUntil - this.now(), 0));
  }

  /** Signed in with device data present: upload it to this account (the person agreed). */
  async attachToAccount() {
    if (!this.serverUserId) return;
    this.meta = { ...this.meta, owner: this.serverUserId, profileDirty: true };
    await this.persist(() => this.deps.persistence.putMeta(this.meta));
    this.mode = "account";
    this.recompute();
    await this.syncNow();
  }

  /** Erases everything on this device (sign-out, or switching accounts after the warning). */
  async wipeDevice() {
    await this.persist(() => this.deps.persistence.clear());
    this.events = [];
    this.base = EMPTY_STATE;
    this.meta = { ...DEFAULT_META };
    this.profile = emptyProfile(this.zone(), this.now());
    this.mode = "device";
    this.setUndo(null);
    this.recompute();
  }

  syncNow(): Promise<void> {
    if (!this.deps.transport) return Promise.resolve();
    if (this.syncing) {
      this.syncAgain = true;
      return this.syncing;
    }
    this.syncing = this.runSync().finally(() => {
      this.syncing = null;
      if (this.syncAgain) {
        this.syncAgain = false;
        this.scheduleSync(50);
      }
    });
    return this.syncing;
  }

  private setPhase(phase: SyncView["phase"], message: string | null = null) {
    this.phase = phase;
    this.message = message;
    this.recompute();
  }

  private measureOffset(serverTime: number, sentAt: number, receivedAt: number) {
    if (receivedAt - sentAt > 5_000) return; // too slow to trust
    const offset = Math.round(serverTime - (sentAt + receivedAt) / 2);
    this.meta = { ...this.meta, serverOffsetMs: Math.abs(offset) < 1_000 ? 0 : offset };
  }

  private async runSync(): Promise<void> {
    const transport = this.deps.transport!;
    if (this.deps.online && !this.deps.online()) {
      this.setPhase("offline", "You're offline. Everything is saved on this device and will sync when you're back.");
      return;
    }
    const raw = this.deps.clock ?? Date.now;
    try {
      const sentAt = raw();
      const status = await transport.status();
      this.measureOffset(status.serverTime, sentAt, raw());
      this.email = status.email;
      this.serverUserId = status.userId;
      if (!status.configured) {
        this.mode = "unconfigured";
        return this.setPhase("idle");
      }
      if (!status.signedIn || !status.userId) {
        this.mode = this.meta.owner === "device" ? "device" : "signed_out";
        return this.setPhase("idle", this.mode === "signed_out" ? "Sign in again to sync. Your changes are safe on this device." : null);
      }
      if (this.meta.owner === "device") {
        const hasData = this.events.length > 0 || this.profile.ledger.length > 0;
        if (hasData) {
          this.mode = "attach_pending";
          return this.setPhase("idle");
        }
        this.meta = { ...this.meta, owner: status.userId };
      } else if (this.meta.owner !== status.userId) {
        this.mode = "foreign_data";
        return this.setPhase("idle", "This device holds another account's data.");
      }
      this.mode = "account";
      this.setPhase("syncing");
      // Profile first: sessions may name a project that must exist on the server.
      if (this.meta.profileDirty) {
        await transport.putProfile({ ...this.profile });
        this.meta = { ...this.meta, profileDirty: false };
      }
      await this.pushEvents(transport);
      const state = await transport.pull();
      this.base = { sessions: Object.fromEntries(state.sessions.map((s) => [s.id, s])) };
      const merged = mergeProfile(this.profile, state.profile);
      if (JSON.stringify(merged) !== JSON.stringify(this.profile)) this.profile = merged;
      this.meta = { ...this.meta, lastSyncedAt: this.now() };
      await this.persist(() => this.deps.persistence.putBase(Object.values(this.base.sessions)));
      await this.persist(() => this.deps.persistence.putProfile(this.profile));
      await this.persist(() => this.deps.persistence.putMeta(this.meta));
      this.failures = 0;
      this.backoffUntil = 0;
      this.setPhase("idle");
    } catch (error) {
      for (const e of this.events) if (e.status === "syncing") e.status = "local";
      this.failures++;
      this.backoffUntil = this.now() + Math.min(5 * 60_000, 2_000 * 2 ** (this.failures - 1));
      if (error instanceof SyncHttpError && error.status === 401) {
        this.mode = "signed_out";
        this.setPhase("idle", "Sign in again to sync. Your changes are safe on this device.");
      } else if (error instanceof SyncHttpError) {
        this.setPhase("error", error.message);
      } else {
        this.setPhase("offline", "Can't reach SHIFTY right now. Everything is saved on this device.");
      }
      await this.persist(() => this.deps.persistence.putMeta(this.meta));
    }
  }

  private async pushEvents(transport: SyncTransport) {
    for (let round = 0; round < 20; round++) {
      const now = this.now();
      const batch: StoredEvent[] = [];
      for (const e of this.events) {
        if (e.status === "rejected") continue;
        if (e.holdUntil !== null && e.holdUntil > now) break; // keep order: nothing after a held event goes first
        if (e.status === "local") batch.push(e);
        if (batch.length >= MAX_BATCH) break;
      }
      if (batch.length === 0) return;
      for (const e of batch) {
        e.status = "syncing";
        e.attempts++;
      }
      this.recompute();
      const response = await transport.push(batch.map((e) => e.event));
      this.applyResults(response.results);
      await this.persist(() => this.deps.persistence.deleteEvents(response.results.filter((r) => r.status !== "rejected").map((r) => r.id)));
      await this.persist(() => this.deps.persistence.putEvents(this.events.filter((e) => e.status === "rejected")));
      this.recompute();
    }
  }

  private applyResults(results: PushResult[]) {
    const sessions = { ...this.base.sessions };
    for (const r of results) {
      const stored = this.events.find((e) => e.event.id === r.id);
      if (r.status === "rejected") {
        if (stored) {
          stored.status = "rejected";
          stored.error = { code: r.code, message: r.message, ...(r.conflictingSessionId ? { conflictingSessionId: r.conflictingSessionId } : {}) } as StoredEvent["error"];
        }
        continue;
      }
      this.events = this.events.filter((e) => e.event.id !== r.id);
      const sessionId = stored?.event.sessionId;
      if (r.session) sessions[r.session.id] = r.session;
      else if (r.status === "applied" && sessionId) delete sessions[sessionId];
    }
    this.base = { sessions };
  }
}
