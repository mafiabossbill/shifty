import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { RepoResult } from "@/lib/api";
import type { Session } from "@/lib/current-user";
import type { Activity, Companion, EarnedAchievement, LedgerEntry, Place, Project, Settings } from "@/lib/shifts/profile";
import type { SessionFlag, ShiftEvent, ShiftSession } from "@/lib/shifts/types";
import type { ProfileDocument } from "@/lib/sync/contract";
import type { ProfilePut } from "@/lib/validation";

/*
 * SHIFTY's server storage behind one interface: Supabase under the person's RLS in the app, an in-memory
 * twin (shifts-memory.ts) in tests that enforces the same invariants. Rules never live here: the routes run
 * the shared reducer (src/lib/shifts/reducer.ts) and this layer only commits what it produced.
 *
 * Every tracking row belongs to one person (user_id); organization_id is stamped from the session for
 * tenancy. Both come from the session, never from a request body.
 */

/** Database object names, in one place (migrations 0100–0199, database-engineer). tests/sync-schema.test.ts checks them. */
export const SHIFT_TABLES = {
  events: "shift_events",
  settings: "user_settings",
  companion: "companion_states",
  projects: "work_projects",
  places: "saved_places",
  activities: "activities",
  ledger: "reward_ledger_entries",
  achievements: "user_achievements",
} as const;

export const SHIFT_RPC = {
  commit: "commit_shift_event",
  load: "load_shift_state",
} as const;

export interface CommitInput {
  event: ShiftEvent;
  /** The session after the reducer (with server flags added), or null for a purge. */
  session: ShiftSession | null;
  sessionId: string;
  /** The revision the server loaded before running the reducer; 0 for a new session. */
  expectedRevision: number;
  flags: SessionFlag[];
}

/** What the database said about one commit. Thrown errors mean transport/unknown failures. */
export type CommitOutcome =
  | { status: "applied"; revision: number }
  | { status: "duplicate" }
  /** Someone committed this session in between (40001): reload, re-run the reducer, retry. */
  | { status: "revision_conflict" }
  /** A unique index refused it (23505): the one-active-session index, or an id already taken. */
  | { status: "unique_violation" }
  | { status: "chronology"; message: string }
  | { status: "forbidden" }
  | { status: "error"; code: string };

export interface ShiftRepository {
  /** Every session the person owns, including the trash, exactly in the ShiftSession shape. */
  loadSessions(): Promise<ShiftSession[]>;
  /** Which of these event ids are already committed. */
  committedEventIds(ids: readonly string[]): Promise<Set<string>>;
  commit(input: CommitInput): Promise<CommitOutcome>;
  loadProfile(): Promise<ProfileDocument>;
  /** Last write wins for settings, companion, projects and places; append-only parts ignore duplicates. */
  saveProfile(put: ProfilePut): Promise<RepoResult<{ ok: true }>>;
  countEvents(): Promise<number>;
}

export function emptyProfile(): ProfileDocument {
  return { settings: null, companion: null, projects: [], places: [], activities: [], ledger: [], achievements: [] };
}

/** Last write wins: an incoming document replaces the stored one when it is at least as new. */
export function lwwAccepts(incomingUpdatedAt: number, storedUpdatedAt: number | null | undefined): boolean {
  return storedUpdatedAt === null || storedUpdatedAt === undefined || incomingUpdatedAt >= storedUpdatedAt;
}

/** Maps a Postgres error from commit_shift_event() to an outcome (the contract in the sync handoff). */
/** load_shift_state() returns `{ sessions: { [id]: ShiftSession } }` (docs/SCHEMA.md); tolerate a bare array. */
export function sessionsFromLoad(data: unknown): ShiftSession[] {
  if (Array.isArray(data)) return data as ShiftSession[];
  const map = (data as { sessions?: Record<string, ShiftSession> } | null)?.sessions;
  return map && typeof map === "object" ? Object.values(map) : [];
}

export function commitOutcomeFor(error: Pick<PostgrestError, "code" | "message">): CommitOutcome {
  switch (error.code) {
    case "40001":
    case "P0002": // session_not_found: reload; the reducer then answers not_found
      return { status: "revision_conflict" };
    case "23503":
      return { status: "chronology", message: "That project hasn't synced yet. Try again in a moment." };
    case "23505":
      return { status: "unique_violation" };
    case "23P01":
      return { status: "chronology", message: "Breaks can't overlap." };
    case "23514":
      return { status: "chronology", message: "These times aren't in order." };
    case "42501":
      return { status: "forbidden" };
    default:
      return { status: "error", code: error.code || "unknown" };
  }
}

const PAGE = 1000;

interface ProjectRow {
  id: string;
  name: string;
  color: Project["color"];
  archived: boolean;
  updated_ms: number;
}
interface PlaceRow {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  updated_ms: number;
}
interface ActivityRow {
  id: string;
  type: Activity["type"];
  key: string;
  at_ms: number;
}
interface LedgerRow {
  event_key: string;
  rule: string;
  xp: number;
  source_session_id: string | null;
  awarded_ms: number;
}
interface AchievementRow {
  code: string;
  earned_ms: number;
  source_session_id: string | null;
}

function fail(what: string, error: PostgrestError): never {
  throw new Error(`Couldn't ${what} (${error.code}): ${error.message}`);
}

function saveFailure(error: PostgrestError): RepoResult<never> {
  if (error.code === "42501") return { ok: false, error: "forbidden", message: "Your account can't save tracking data in this workspace." };
  if (error.code === "23514" || error.code === "22P02") return { ok: false, error: "invalid", message: "Some of these settings aren't valid." };
  fail("save your profile", error);
}

export class SupabaseShiftRepository implements ShiftRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly userId: string,
    /** Needed for writes only; the account export reads without a workspace. */
    private readonly organizationId: string | null,
  ) {}

  async loadSessions(): Promise<ShiftSession[]> {
    const { data, error } = await this.supabase.rpc(SHIFT_RPC.load);
    if (error) fail("load your sessions", error);
    return sessionsFromLoad(data);
  }

  async committedEventIds(ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const { data, error } = await this.supabase.from(SHIFT_TABLES.events).select("id").eq("user_id", this.userId).in("id", [...new Set(ids)]);
    if (error) fail("check synced events", error);
    return new Set(((data ?? []) as { id: string }[]).map((row) => row.id));
  }

  async commit(input: CommitInput): Promise<CommitOutcome> {
    const { data, error } = await this.supabase.rpc(SHIFT_RPC.commit, {
      p_event: input.event,
      p_session: input.session,
      p_session_id: input.sessionId,
      p_expected_revision: input.expectedRevision,
      p_flags: input.flags,
    });
    if (error) return commitOutcomeFor(error);
    const result = (data ?? {}) as { status?: string; revision?: number };
    if (result.status === "duplicate") return { status: "duplicate" };
    if (result.status === "applied") return { status: "applied", revision: Number(result.revision ?? input.session?.revision ?? 0) };
    return { status: "error", code: "unexpected_response" };
  }

  /** Reads every row of a list in pages (PostgREST caps a response at 1000 rows). */
  private async all<T>(table: string, columns: string, order: string): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.supabase
        .from(table)
        .select(columns)
        .eq("user_id", this.userId)
        .order(order)
        .range(from, from + PAGE - 1);
      if (error) fail(`load ${table}`, error);
      const page = Array.isArray(data) ? (data as T[]) : [];
      rows.push(...page);
      if (page.length < PAGE) return rows;
    }
  }

  private async document<T>(table: string, column: string): Promise<T | null> {
    const { data, error } = await this.supabase.from(table).select(column).eq("user_id", this.userId).maybeSingle();
    if (error) fail(`load ${table}`, error);
    const row = data as Record<string, unknown> | null;
    return (row && !Array.isArray(row) ? (row[column] as T | undefined) : undefined) ?? null;
  }

  async loadProfile(): Promise<ProfileDocument> {
    const t = SHIFT_TABLES;
    const [settings, companion, projects, places, activities, ledger, achievements] = await Promise.all([
      this.document<Settings>(t.settings, "settings"),
      this.document<Companion>(t.companion, "state"),
      this.all<ProjectRow>(t.projects, "id, name, color, archived, updated_ms", "id"),
      this.all<PlaceRow>(t.places, "id, label, latitude, longitude, radius_m, updated_ms", "id"),
      this.all<ActivityRow>(t.activities, "id, type, key, at_ms", "at_ms"),
      this.all<LedgerRow>(t.ledger, "event_key, rule, xp, source_session_id, awarded_ms", "awarded_ms"),
      this.all<AchievementRow>(t.achievements, "code, earned_ms, source_session_id", "earned_ms"),
    ]);
    return {
      settings,
      companion,
      projects: projects.map((r): Project => ({ id: r.id, name: r.name, color: r.color, archived: r.archived, updatedAt: Number(r.updated_ms) })),
      places: places.map(
        (r): Place => ({ id: r.id, label: r.label, latitude: Number(r.latitude), longitude: Number(r.longitude), radiusM: r.radius_m, updatedAt: Number(r.updated_ms) }),
      ),
      activities: activities.map((r): Activity => ({ id: r.id, type: r.type, key: r.key, at: Number(r.at_ms) })),
      ledger: ledger.map((r): LedgerEntry => ({ key: r.event_key, rule: r.rule, xp: r.xp, sourceSessionId: r.source_session_id, at: Number(r.awarded_ms) })),
      achievements: achievements.map((r): EarnedAchievement => ({ code: r.code, earnedAt: Number(r.earned_ms), sourceSessionId: r.source_session_id })),
    };
  }

  private owner() {
    if (!this.organizationId) throw new Error("Writing tracking data needs a workspace.");
    return { user_id: this.userId, organization_id: this.organizationId };
  }

  /** One-row document (settings, companion): update only when not older, else insert if missing. */
  private async saveDocument(table: string, column: string, value: unknown, updatedMs: number): Promise<PostgrestError | null> {
    const updated = await this.supabase
      .from(table)
      .update({ [column]: value, updated_ms: updatedMs })
      .eq("user_id", this.userId)
      .lte("updated_ms", updatedMs)
      .select("user_id");
    if (updated.error) return updated.error;
    if ((updated.data ?? []).length > 0) return null;
    // No row, or a newer one: insert, and a newer stored row wins (ignore duplicates).
    const inserted = await this.supabase
      .from(table)
      .upsert({ ...this.owner(), [column]: value, updated_ms: updatedMs }, { onConflict: "user_id", ignoreDuplicates: true });
    return inserted.error;
  }

  /** Per-row last write wins (projects, places). */
  private async saveRows(table: string, rows: { id: string; updated_ms: number }[]): Promise<PostgrestError | null> {
    if (rows.length === 0) return null;
    const existing = await this.supabase
      .from(table)
      .select("id, updated_ms")
      .eq("user_id", this.userId)
      .in(
        "id",
        rows.map((r) => r.id),
      );
    if (existing.error) return existing.error;
    const stored = new Map(((existing.data ?? []) as { id: string; updated_ms: number }[]).map((r) => [r.id, Number(r.updated_ms)]));
    const winners = rows.filter((r) => lwwAccepts(r.updated_ms, stored.get(r.id)));
    if (winners.length === 0) return null;
    const owner = this.owner();
    const { error } = await this.supabase.from(table).upsert(
      winners.map((r) => ({ ...r, ...owner })),
      { onConflict: "id" },
    );
    return error;
  }

  /** Insert-only rows (activities, ledger, achievements): a repeat is ignored, never updated. */
  private async appendRows(table: string, conflict: string, rows: Record<string, unknown>[]): Promise<PostgrestError | null> {
    if (rows.length === 0) return null;
    const owner = this.owner();
    const { error } = await this.supabase.from(table).upsert(
      rows.map((r) => ({ ...r, ...owner })),
      { onConflict: conflict, ignoreDuplicates: true },
    );
    return error;
  }

  async saveProfile(put: ProfilePut): Promise<RepoResult<{ ok: true }>> {
    const t = SHIFT_TABLES;
    const steps: (() => Promise<PostgrestError | null>)[] = [];
    if (put.settings) steps.push(() => this.saveDocument(t.settings, "settings", put.settings, put.settings!.updatedAt));
    if (put.companion) steps.push(() => this.saveDocument(t.companion, "state", put.companion, put.companion!.updatedAt));
    if (put.projects) {
      const rows = put.projects.map((p) => ({ id: p.id, name: p.name, color: p.color, archived: p.archived, updated_ms: p.updatedAt }));
      steps.push(() => this.saveRows(t.projects, rows));
    }
    if (put.places) {
      const rows = put.places.map((p) => ({ id: p.id, label: p.label, latitude: p.latitude, longitude: p.longitude, radius_m: p.radiusM, updated_ms: p.updatedAt }));
      steps.push(() => this.saveRows(t.places, rows));
    }
    if (put.activities) {
      const rows = put.activities.map((a) => ({ id: a.id, type: a.type, key: a.key, at_ms: a.at }));
      steps.push(() => this.appendRows(t.activities, "user_id,id", rows));
    }
    if (put.ledger) {
      const rows = put.ledger.map((l) => ({ event_key: l.key, rule: l.rule, xp: l.xp, source_session_id: l.sourceSessionId, awarded_ms: l.at }));
      steps.push(() => this.appendRows(t.ledger, "user_id,event_key", rows));
    }
    if (put.achievements) {
      const rows = put.achievements.map((a) => ({ code: a.code, earned_ms: a.earnedAt, source_session_id: a.sourceSessionId }));
      steps.push(() => this.appendRows(t.achievements, "user_id,code", rows));
    }
    // In order, stopping at the first failure. Each step is idempotent, so the device can resend the lot.
    for (const step of steps) {
      const error = await step();
      if (error) return saveFailure(error);
    }
    return { ok: true, value: { ok: true } };
  }

  async countEvents(): Promise<number> {
    const { count, error } = await this.supabase.from(SHIFT_TABLES.events).select("id", { count: "exact", head: true }).eq("user_id", this.userId);
    if (error) fail("count your events", error);
    return count ?? 0;
  }
}

/** The repository for a signed-in request (route tests replace this with the in-memory twin). */
export function shiftRepositoryFor(session: Pick<Session, "supabase" | "user" | "organization">): ShiftRepository {
  return new SupabaseShiftRepository(session.supabase, session.user.id, session.organization.id);
}
