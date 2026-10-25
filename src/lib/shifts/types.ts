/**
 * The SHIFTY domain. A session is the canonical entity; calendar days are derived (src/lib/time/allocate.ts).
 * All instants are epoch milliseconds (UTC). Every change is an event with a device-generated id; the same
 * pure reducer (reducer.ts) folds events on the device and on the server, so both agree by construction.
 */

export type SessionStatus = "active" | "on_break" | "completed";
export type SessionOrigin = "timer" | "manual";
export type BreakKind = "rest" | "meal" | "other";

export interface ShiftBreak {
  id: string;
  startedAt: number;
  endedAt: number | null;
  kind: BreakKind;
}

export type LocationEvent = "clock_in" | "clock_out" | "retry";
/** What happened when we asked. Only `captured` carries coordinates — nothing is ever made up. */
export type LocationStatus = "captured" | "denied" | "unavailable" | "timeout" | "unsupported" | "off" | "insecure";

export interface LocationFix {
  id: string;
  event: LocationEvent;
  status: LocationStatus;
  requestedAt: number;
  capturedAt: number | null;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  /** Matched remembered place (device-side, by distance). No reverse geocoding (A05). */
  placeLabel: string | null;
}

/** The fields a correction can change, as they were before and after. */
export interface TimeSnapshot {
  startedAt: number;
  endedAt: number | null;
  breaks: ShiftBreak[];
}

export interface SessionRevision {
  /** = the correcting event's id. */
  id: string;
  at: number;
  reason: string;
  previous: TimeSnapshot;
  updated: TimeSnapshot;
}

export type SessionFlag = "device_clock_ahead" | "device_clock_behind" | "timezone_changed";

export interface ShiftSession {
  id: string;
  /** Immutable: the event that created the session and the start it recorded. */
  originEventId: string;
  originalStartedAt: number;
  startedAt: number;
  endedAt: number | null;
  origin: SessionOrigin;
  /** Day boundaries for this session's reports. Snapshotted at clock-in; changed only by an explicit rezone. */
  reportingTimeZone: string;
  startTimeZone: string;
  endTimeZone: string | null;
  goalSeconds: number;
  title: string;
  notes: string;
  projectId: string | null;
  tags: string[];
  /** Hourly rate in minor units of `currency`, when pay tracking is on. */
  payRateMinor: number | null;
  currency: string | null;
  mood: number | null;
  energy: number | null;
  breaks: ShiftBreak[];
  locations: LocationFix[];
  revisions: SessionRevision[];
  flags: SessionFlag[];
  archivedAt: number | null;
  deletedAt: number | null;
  /** Increments with every applied event; corrections must name the revision they were made against. */
  revision: number;
  createdAt: number;
  updatedAt: number;
}

export interface ShiftState {
  sessions: Record<string, ShiftSession>;
}

export const EMPTY_STATE: ShiftState = { sessions: {} };

interface EventBase {
  /** Device-generated UUID: the idempotency key end to end. */
  id: string;
  /** The instant the event is about (start, end, break time) or, for edits, when the edit was made. */
  at: number;
  /** Device clock when the event was recorded (corrected by the known server offset). */
  recordedAt: number;
  deviceTimeZone: string;
}

export interface SessionDetails {
  title?: string;
  notes?: string;
  projectId?: string | null;
  tags?: string[];
  payRateMinor?: number | null;
  currency?: string | null;
}

export type ShiftEvent =
  | (EventBase & {
      type: "clock_in";
      sessionId: string;
      goalSeconds: number;
      reportingTimeZone: string;
    } & SessionDetails)
  | (EventBase & { type: "break_start"; sessionId: string; breakId: string; kind?: BreakKind })
  | (EventBase & { type: "break_end"; sessionId: string; breakId: string })
  | (EventBase & { type: "clock_out"; sessionId: string })
  | (EventBase & { type: "location"; sessionId: string; fix: LocationFix })
  | (EventBase & { type: "location_delete"; sessionId: string; fixId: string })
  | (EventBase & {
      type: "annotate";
      sessionId: string;
      changes: SessionDetails & { mood?: number | null; energy?: number | null; goalSeconds?: number; archived?: boolean };
    })
  | (EventBase & {
      type: "correct";
      sessionId: string;
      expectedRevision: number;
      reason: string;
      startedAt?: number;
      endedAt?: number | null;
      breaks?: ShiftBreak[];
      allowOverlap?: boolean;
    })
  | (EventBase & {
      type: "manual_create";
      sessionId: string;
      startedAt: number;
      endedAt: number;
      breaks: ShiftBreak[];
      goalSeconds: number;
      reportingTimeZone: string;
      allowOverlap?: boolean;
    } & SessionDetails)
  | (EventBase & { type: "rezone"; sessionId: string; reportingTimeZone: string; expectedRevision: number })
  /** Restores a session from a backup exactly as exported (origin, locations, audit history kept). */
  | (EventBase & { type: "import_session"; sessionId: string; session: ShiftSession; allowOverlap?: boolean })
  | (EventBase & { type: "delete"; sessionId: string })
  | (EventBase & { type: "restore"; sessionId: string })
  | (EventBase & { type: "purge"; sessionId: string });

export type ShiftEventType = ShiftEvent["type"];

export type ShiftErrorCode =
  | "active_exists"
  | "not_found"
  | "invalid_state"
  | "chronology"
  | "overlap"
  | "revision_mismatch"
  | "validation";

export interface ShiftError {
  code: ShiftErrorCode;
  message: string;
  /** The session that blocks the change (overlap / active_exists). */
  conflictingSessionId?: string;
}

export type ApplyResult = { ok: true; state: ShiftState; session: ShiftSession | null } | { ok: false; error: ShiftError };

/** HTTP status the API answers for each error (doctrine §12). */
export const ERROR_STATUS: Record<ShiftErrorCode, number> = {
  active_exists: 409,
  not_found: 404,
  invalid_state: 409,
  chronology: 400,
  overlap: 409,
  revision_mismatch: 409,
  validation: 400,
};

export function sessionStatus(s: Pick<ShiftSession, "endedAt" | "breaks">): SessionStatus {
  if (s.endedAt !== null) return "completed";
  return s.breaks.some((b) => b.endedAt === null) ? "on_break" : "active";
}

/** The live session, if any (deleted sessions never count). */
export function activeSession(state: ShiftState): ShiftSession | null {
  for (const s of Object.values(state.sessions)) {
    if (s.endedAt === null && s.deletedAt === null) return s;
  }
  return null;
}

export function visibleSessions(state: ShiftState): ShiftSession[] {
  return Object.values(state.sessions)
    .filter((s) => s.deletedAt === null)
    .sort((a, b) => b.startedAt - a.startedAt);
}
