/**
 * The session state machine (TRD §3.4), as one pure function. The device folds its event log with it and
 * the server re-runs it before committing, so a rule lives in exactly one place. It never reads the clock:
 * every instant comes from the event. Invalid transitions return an error and leave the state untouched.
 *
 *   INACTIVE ─clock_in→ ACTIVE ─break_start→ ON_BREAK ─break_end→ ACTIVE
 *   ACTIVE | ON_BREAK ─clock_out→ COMPLETED (an open break closes at the clock-out instant)
 *   COMPLETED ─correct (reason + expected revision)→ COMPLETED; never silently reopened.
 */
import { isValidTimeZone } from "@/lib/time/zone";

import {
  activeSession,
  sessionStatus,
  type ApplyResult,
  type ShiftBreak,
  type ShiftError,
  type ShiftEvent,
  type ShiftSession,
  type ShiftState,
  type TimeSnapshot,
} from "./types";

export const MIN_GOAL_SECONDS = 60;
export const MAX_GOAL_SECONDS = 48 * 3600;
export const DEFAULT_GOAL_SECONDS = 16 * 3600;

const fail = (code: ShiftError["code"], message: string, conflictingSessionId?: string): ApplyResult => ({
  ok: false,
  error: conflictingSessionId ? { code, message, conflictingSessionId } : { code, message },
});

function put(state: ShiftState, session: ShiftSession): ApplyResult {
  return { ok: true, state: { sessions: { ...state.sessions, [session.id]: session } }, session };
}

function touch(session: ShiftSession, event: ShiftEvent, patch: Partial<ShiftSession>): ShiftSession {
  return { ...session, ...patch, revision: session.revision + 1, updatedAt: event.recordedAt };
}

export function timeSnapshot(s: Pick<ShiftSession, "startedAt" | "endedAt" | "breaks">): TimeSnapshot {
  return { startedAt: s.startedAt, endedAt: s.endedAt, breaks: s.breaks.map((b) => ({ ...b })) };
}

function sortBreaks(breaks: readonly ShiftBreak[]): ShiftBreak[] {
  return [...breaks].sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id));
}

/** Chronology of a session's own times. Returns a sentence for the person, or null when valid. */
export function validateTimes(t: TimeSnapshot): string | null {
  if (!Number.isSafeInteger(t.startedAt) || (t.endedAt !== null && !Number.isSafeInteger(t.endedAt))) return "Times must be valid instants.";
  if (t.endedAt !== null && t.endedAt <= t.startedAt) return "The end must be after the start.";
  const breaks = sortBreaks(t.breaks);
  const ids = new Set<string>();
  let previousEnd = t.startedAt;
  for (const [i, b] of breaks.entries()) {
    if (ids.has(b.id)) return "Two breaks share an id.";
    ids.add(b.id);
    if (b.startedAt < t.startedAt) return "A break can't start before the session.";
    if (b.startedAt < previousEnd) return "Breaks can't overlap.";
    if (b.endedAt === null) {
      if (t.endedAt !== null) return "A finished session can't have an open break.";
      if (i !== breaks.length - 1) return "Only the latest break can still be running.";
    } else {
      if (b.endedAt <= b.startedAt) return "A break must end after it starts.";
      if (t.endedAt !== null && b.endedAt > t.endedAt) return "A break can't end after the session.";
      previousEnd = b.endedAt;
    }
  }
  return null;
}

/** First visible session other than `exceptId` whose interval overlaps [start, end) (end null = running). */
export function findOverlap(state: ShiftState, start: number, end: number | null, exceptId?: string): ShiftSession | null {
  const until = end ?? Number.POSITIVE_INFINITY;
  for (const s of Object.values(state.sessions)) {
    if (s.id === exceptId || s.deletedAt !== null) continue;
    const otherEnd = s.endedAt ?? Number.POSITIVE_INFINITY;
    if (start < otherEnd && s.startedAt < until) return s;
  }
  return null;
}

function validGoal(goalSeconds: unknown): goalSeconds is number {
  return Number.isInteger(goalSeconds) && (goalSeconds as number) >= MIN_GOAL_SECONDS && (goalSeconds as number) <= MAX_GOAL_SECONDS;
}

const cleanTitle = (title: string | undefined) => (title ?? "").trim().slice(0, 120);
const cleanTags = (tags: string[] | undefined) =>
  [...new Set((tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12).map((t) => t.slice(0, 32));

function newSession(event: Extract<ShiftEvent, { type: "clock_in" | "manual_create" }>, startedAt: number, endedAt: number | null, breaks: ShiftBreak[]): ShiftSession {
  return {
    id: event.sessionId,
    originEventId: event.id,
    originalStartedAt: startedAt,
    startedAt,
    endedAt,
    origin: event.type === "clock_in" ? "timer" : "manual",
    reportingTimeZone: event.reportingTimeZone,
    startTimeZone: event.deviceTimeZone,
    endTimeZone: endedAt === null ? null : event.deviceTimeZone,
    goalSeconds: event.goalSeconds,
    title: cleanTitle(event.title),
    notes: (event.notes ?? "").slice(0, 4000),
    projectId: event.projectId ?? null,
    tags: cleanTags(event.tags),
    payRateMinor: event.payRateMinor ?? null,
    currency: event.currency ?? null,
    mood: null,
    energy: null,
    breaks: sortBreaks(breaks),
    locations: [],
    revisions: [],
    flags: [],
    archivedAt: null,
    deletedAt: null,
    revision: 1,
    createdAt: event.recordedAt,
    updatedAt: event.recordedAt,
  };
}

export function applyEvent(state: ShiftState, event: ShiftEvent): ApplyResult {
  const existing = state.sessions[event.sessionId] as ShiftSession | undefined;

  if (event.type === "clock_in" || event.type === "manual_create") {
    if (existing) {
      // The same event replayed (double tap, retry) is a no-op; another event reusing the id is a bug.
      if (existing.originEventId === event.id) return { ok: true, state, session: existing };
      return fail("validation", "This session id is already used.");
    }
    if (!isValidTimeZone(event.reportingTimeZone)) return fail("validation", "Unknown reporting timezone.");
    if (!validGoal(event.goalSeconds)) return fail("validation", "The goal must be between 1 minute and 48 hours.");
    if (event.type === "clock_in") {
      const running = activeSession(state);
      if (running) return fail("active_exists", "A session is already running.", running.id);
      const inside = findOverlap(state, event.at, event.at + 1);
      if (inside) return fail("overlap", "This start falls inside another session.", inside.id);
      return put(state, newSession(event, event.at, null, []));
    }
    const times = { startedAt: event.startedAt, endedAt: event.endedAt, breaks: event.breaks };
    const problem = validateTimes(times);
    if (problem) return fail("chronology", problem);
    if (!event.allowOverlap) {
      const other = findOverlap(state, event.startedAt, event.endedAt);
      if (other) return fail("overlap", "These times overlap another session.", other.id);
    }
    return put(state, newSession(event, event.startedAt, event.endedAt, event.breaks));
  }

  if (event.type === "import_session") {
    if (existing) return existing.originEventId === event.session.originEventId ? { ok: true, state, session: existing } : fail("validation", "This session id is already used.");
    const s = event.session;
    if (s.id !== event.sessionId) return fail("validation", "The session id doesn't match.");
    if (!isValidTimeZone(s.reportingTimeZone)) return fail("validation", "Unknown reporting timezone.");
    if (!validGoal(s.goalSeconds)) return fail("validation", "The goal must be between 1 minute and 48 hours.");
    if (s.endedAt === null) return fail("validation", "Only finished sessions can be imported.");
    const problem = validateTimes(s);
    if (problem) return fail("chronology", problem);
    if (s.deletedAt === null && !event.allowOverlap) {
      const other = findOverlap(state, s.startedAt, s.endedAt);
      if (other) return fail("overlap", "This session overlaps one you already have.", other.id);
    }
    return put(state, { ...s, breaks: sortBreaks(s.breaks), revision: 1, updatedAt: event.recordedAt });
  }

  if (!existing) return fail("not_found", "That session doesn't exist.");
  const session = existing;

  if (event.type === "purge") {
    if (session.deletedAt === null) return fail("invalid_state", "Only sessions in the trash can be deleted for good.");
    const sessions = { ...state.sessions };
    delete sessions[session.id];
    return { ok: true, state: { sessions }, session: null };
  }

  if (event.type === "restore") {
    if (session.deletedAt === null) return { ok: true, state, session };
    if (session.endedAt === null) {
      const running = activeSession(state);
      if (running) return fail("active_exists", "Another session is running; finish it before restoring this one.", running.id);
    }
    const other = findOverlap(state, session.startedAt, session.endedAt, session.id);
    if (other) return fail("overlap", "Restoring this would overlap another session.", other.id);
    return put(state, touch(session, event, { deletedAt: null }));
  }

  if (session.deletedAt !== null) return fail("invalid_state", "That session is in the trash.");
  const status = sessionStatus(session);

  switch (event.type) {
    case "break_start": {
      if (status !== "active") return fail("invalid_state", status === "on_break" ? "A break is already running." : "This session has finished.");
      if (event.at < session.startedAt) return fail("chronology", "A break can't start before the session.");
      const lastEnd = Math.max(session.startedAt, ...session.breaks.map((b) => b.endedAt ?? 0));
      if (event.at < lastEnd) return fail("chronology", "A break can't start before the previous one ended.");
      if (session.breaks.some((b) => b.id === event.breakId)) return fail("validation", "This break id is already used.");
      const added: ShiftBreak = { id: event.breakId, startedAt: event.at, endedAt: null, kind: event.kind ?? "rest" };
      return put(state, touch(session, event, { breaks: sortBreaks([...session.breaks, added]) }));
    }
    case "break_end": {
      const open = session.breaks.find((b) => b.id === event.breakId);
      if (!open || open.endedAt !== null) return fail("invalid_state", "That break isn't running.");
      if (event.at < open.startedAt) return fail("chronology", "A break can't end before it starts.");
      const breaks = session.breaks.map((b) => (b.id === open.id ? { ...b, endedAt: event.at } : b));
      return put(state, touch(session, event, { breaks }));
    }
    case "clock_out": {
      if (status === "completed") return fail("invalid_state", "This session has already finished.");
      if (event.at < session.startedAt) return fail("chronology", "Clock-out can't be before clock-in.");
      const closedEnd = Math.max(...session.breaks.map((b) => b.endedAt ?? 0), 0);
      const open = session.breaks.find((b) => b.endedAt === null);
      if (event.at < closedEnd || (open && event.at < open.startedAt)) return fail("chronology", "Clock-out can't be before a break ended.");
      // An open break closes at the clock-out instant, as its own explicit part of this event.
      const breaks = session.breaks.map((b) => (b.endedAt === null ? { ...b, endedAt: event.at } : b));
      return put(state, touch(session, event, { endedAt: event.at, endTimeZone: event.deviceTimeZone, breaks }));
    }
    case "location": {
      const fix = event.fix;
      if (fix.status === "captured" && (fix.latitude === null || fix.longitude === null)) {
        return fail("validation", "A captured location needs coordinates.");
      }
      if (fix.status !== "captured" && (fix.latitude !== null || fix.longitude !== null)) {
        return fail("validation", "Coordinates only come with a captured location.");
      }
      const locations = [...session.locations.filter((l) => l.id !== fix.id), { ...fix }].sort((a, b) => a.requestedAt - b.requestedAt);
      return put(state, touch(session, event, { locations }));
    }
    case "location_delete": {
      if (!session.locations.some((l) => l.id === event.fixId)) return { ok: true, state, session };
      return put(state, touch(session, event, { locations: session.locations.filter((l) => l.id !== event.fixId) }));
    }
    case "annotate": {
      const c = event.changes;
      if (c.goalSeconds !== undefined && !validGoal(c.goalSeconds)) return fail("validation", "The goal must be between 1 minute and 48 hours.");
      for (const rating of [c.mood, c.energy]) {
        if (rating !== undefined && rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
          return fail("validation", "Ratings go from 1 to 5.");
        }
      }
      const patch: Partial<ShiftSession> = {};
      if (c.title !== undefined) patch.title = cleanTitle(c.title);
      if (c.notes !== undefined) patch.notes = c.notes.slice(0, 4000);
      if (c.projectId !== undefined) patch.projectId = c.projectId;
      if (c.tags !== undefined) patch.tags = cleanTags(c.tags);
      if (c.payRateMinor !== undefined) patch.payRateMinor = c.payRateMinor;
      if (c.currency !== undefined) patch.currency = c.currency;
      if (c.mood !== undefined) patch.mood = c.mood;
      if (c.energy !== undefined) patch.energy = c.energy;
      if (c.goalSeconds !== undefined) patch.goalSeconds = c.goalSeconds;
      if (c.archived !== undefined) patch.archivedAt = c.archived ? (session.archivedAt ?? event.at) : null;
      return put(state, touch(session, event, patch));
    }
    case "correct": {
      if (event.expectedRevision !== session.revision) {
        return fail("revision_mismatch", "This session changed since you opened it. Review the latest version and try again.");
      }
      const reason = event.reason.trim();
      if (reason.length < 3) return fail("validation", "Say briefly why you're correcting the times.");
      if (event.endedAt === null && session.endedAt !== null) return fail("invalid_state", "A finished session can't be reopened.");
      if (typeof event.endedAt === "number" && session.endedAt === null) return fail("invalid_state", "Use Clock out to finish a running session.");
      const updated: TimeSnapshot = {
        startedAt: event.startedAt ?? session.startedAt,
        endedAt: event.endedAt === undefined ? session.endedAt : event.endedAt,
        breaks: sortBreaks(event.breaks ?? session.breaks),
      };
      const problem = validateTimes(updated);
      if (problem) return fail("chronology", problem);
      const previous = timeSnapshot(session);
      if (JSON.stringify(previous) === JSON.stringify(updated)) return fail("validation", "Nothing changed.");
      if (!event.allowOverlap) {
        const other = findOverlap(state, updated.startedAt, updated.endedAt, session.id);
        if (other) return fail("overlap", "These times overlap another session.", other.id);
      }
      const revision = { id: event.id, at: event.at, reason: reason.slice(0, 500), previous, updated };
      return put(
        state,
        touch(session, event, { startedAt: updated.startedAt, endedAt: updated.endedAt, breaks: updated.breaks, revisions: [...session.revisions, revision] }),
      );
    }
    case "rezone": {
      if (event.expectedRevision !== session.revision) return fail("revision_mismatch", "This session changed since you previewed it.");
      if (!isValidTimeZone(event.reportingTimeZone)) return fail("validation", "Unknown reporting timezone.");
      if (event.reportingTimeZone === session.reportingTimeZone) return { ok: true, state, session };
      return put(state, touch(session, event, { reportingTimeZone: event.reportingTimeZone }));
    }
    case "delete":
      return put(state, touch(session, event, { deletedAt: event.at }));
  }
}

export interface Rejection {
  event: ShiftEvent;
  error: ShiftError;
}

/** Folds events in order onto a base state. Rejected events are reported, never half-applied. */
export function foldEvents(events: readonly ShiftEvent[], base: ShiftState): { state: ShiftState; rejected: Rejection[] } {
  let state = base;
  const rejected: Rejection[] = [];
  for (const event of events) {
    const result = applyEvent(state, event);
    if (result.ok) state = result.state;
    else rejected.push({ event, error: result.error });
  }
  return { state, rejected };
}
