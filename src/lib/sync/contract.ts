/**
 * Device ↔ server sync contract. The device is the source of intent (an ordered event log); the server is
 * the source of truth once an event is accepted. Every route answers `{ data }` or `{ error }`.
 *
 * GET  /api/sync/status   → StatusResponse            (always 200; tells the app whether sync exists here)
 * GET  /api/sync/state    → StateResponse             (401 signed out, 503 not configured)
 * POST /api/sync/events   PushRequest → PushResponse  (events applied in array order, one result each)
 * PUT  /api/sync/profile  ProfilePutRequest → { data: { ok: true, serverTime } }
 *
 * Per-event outcome (never a silent overwrite):
 *  - applied: the reducer accepted it and it was committed atomically; `session` is the committed state
 *    (null after a purge).
 *  - duplicate: this event id was already committed (retry, double send); nothing changed.
 *  - rejected: the server state doesn't allow it (code from ShiftErrorCode, or "forbidden" / "server").
 *    The device keeps the event and shows it under "Needs attention" with the message.
 */
import type { Activity, Companion, EarnedAchievement, LedgerEntry, Place, Project, Settings } from "@/lib/shifts/profile";
import type { ShiftErrorCode, ShiftEvent, ShiftSession } from "@/lib/shifts/types";

export interface StatusResponse {
  data: { configured: boolean; signedIn: boolean; userId: string | null; email: string | null; serverTime: number };
}

export interface ProfileDocument {
  settings: Settings | null;
  companion: Companion | null;
  projects: Project[];
  places: Place[];
  activities: Activity[];
  ledger: LedgerEntry[];
  achievements: EarnedAchievement[];
}

export interface StateResponse {
  data: { sessions: ShiftSession[]; profile: ProfileDocument; serverTime: number };
}

export interface PushRequest {
  /** 1…100 events, oldest first. */
  events: ShiftEvent[];
}

export type PushResult =
  | { id: string; status: "applied" | "duplicate"; session: ShiftSession | null }
  | { id: string; status: "rejected"; code: ShiftErrorCode | "forbidden" | "server"; message: string; conflictingSessionId?: string };

export interface PushResponse {
  data: { results: PushResult[]; serverTime: number };
}

/** Last write wins per document (settings, companion) and per row (projects, places); activities, ledger
 * and achievements are append-only (insert, ignore duplicates by key). */
export interface ProfilePutRequest {
  settings?: Settings;
  companion?: Companion;
  projects?: Project[];
  places?: Place[];
  activities?: Activity[];
  ledger?: LedgerEntry[];
  achievements?: EarnedAchievement[];
}

/** Events dated further ahead of server time than this are accepted but flagged `device_clock_ahead`. */
export const CLOCK_AHEAD_TOLERANCE_MS = 2 * 60_000;
export const MAX_PUSH_BATCH = 100;
