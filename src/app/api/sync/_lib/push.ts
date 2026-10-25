import "server-only";

import type { ShiftRepository } from "@/lib/data/shifts";
import { logEvent } from "@/lib/log";
import { applyEvent } from "@/lib/shifts/reducer";
import { parseShiftEvent } from "@/lib/shifts/schema";
import { activeSession, type SessionFlag, type ShiftEvent, type ShiftSession, type ShiftState } from "@/lib/shifts/types";
import { CLOCK_AHEAD_TOLERANCE_MS, type PushResult } from "@/lib/sync/contract";

/** Attempts per event when another device commits the same session in between (SQLSTATE 40001). */
export const MAX_COMMIT_ATTEMPTS = 1 + 3;

const SERVER_FAILED = "The server couldn't save this change. It's kept on this device; sync again in a moment.";
const RACED = "Another device changed this session at the same moment. Sync again to retry.";
const FORBIDDEN = "Your account can't track shifts in this workspace.";

function toState(sessions: ShiftSession[]): ShiftState {
  return { sessions: Object.fromEntries(sessions.map((s) => [s.id, s])) };
}

function rawId(raw: unknown, index: number): string {
  const id = raw && typeof raw === "object" ? (raw as { id?: unknown }).id : undefined;
  return typeof id === "string" && id.length > 0 && id.length <= 80 ? id : `#${index}`;
}

/** Server-observed facts recorded on the session. Informational only: they never change a time. */
function serverFlags(event: ShiftEvent, now: number): SessionFlag[] {
  return event.at > now + CLOCK_AHEAD_TOLERANCE_MS ? ["device_clock_ahead"] : [];
}

function withFlags(session: ShiftSession | null, flags: SessionFlag[]): ShiftSession | null {
  if (!session || flags.every((f) => session.flags.includes(f))) return session;
  return { ...session, flags: [...session.flags, ...flags.filter((f) => !session.flags.includes(f))] };
}

export interface PushSummary {
  results: PushResult[];
  counts: { applied: number; duplicate: number; rejected: number; retries: number };
}

/**
 * Applies a batch in order. For each event: already committed → duplicate; else the shared reducer decides
 * (a rejection is reported with its code), then the result is committed atomically with the revision we
 * loaded. A concurrent commit (revision_conflict) reloads the state and re-runs the reducer. The local
 * state follows every success so later events in the batch see it. Never throws for one bad event.
 */
export async function pushEvents(repo: ShiftRepository, raws: readonly unknown[], now: number, userId: string): Promise<PushSummary> {
  const parsed = raws.map((raw) => parseShiftEvent(raw));
  const ids = parsed.flatMap((p) => (p.ok ? [p.event.id] : []));
  const committed = await repo.committedEventIds(ids);
  let state = toState(await repo.loadSessions());
  const counts = { applied: 0, duplicate: 0, rejected: 0, retries: 0 };
  const results: PushResult[] = [];

  const reload = async () => {
    state = toState(await repo.loadSessions());
  };

  const pushOne = async (event: ShiftEvent): Promise<PushResult> => {
    const id = event.id;
    if (committed.has(id)) return { id, status: "duplicate", session: state.sessions[event.sessionId] ?? null };
    const flags = serverFlags(event, now);
    let reloaded = false;

    for (let attempt = 0; attempt < MAX_COMMIT_ATTEMPTS; attempt++) {
      const applied = applyEvent(state, event);
      if (!applied.ok) {
        // After a reload the state may already contain this very event, committed by a parallel request.
        if (reloaded && (await repo.committedEventIds([id])).has(id)) {
          committed.add(id);
          return { id, status: "duplicate", session: state.sessions[event.sessionId] ?? null };
        }
        const { code, message, conflictingSessionId } = applied.error;
        return conflictingSessionId ? { id, status: "rejected", code, message, conflictingSessionId } : { id, status: "rejected", code, message };
      }
      const session = withFlags(applied.session, flags);
      const expectedRevision = state.sessions[event.sessionId]?.revision ?? 0;
      const outcome = await repo.commit({ event, session, sessionId: event.sessionId, expectedRevision, flags });

      switch (outcome.status) {
        case "applied": {
          const sessions = { ...applied.state.sessions };
          if (session) sessions[session.id] = session;
          else delete sessions[event.sessionId];
          state = { sessions };
          committed.add(id);
          return { id, status: "applied", session };
        }
        case "duplicate":
          committed.add(id);
          await reload();
          return { id, status: "duplicate", session: state.sessions[event.sessionId] ?? null };
        case "revision_conflict":
          counts.retries += 1;
          await reload();
          reloaded = true;
          continue;
        case "unique_violation": {
          await reload();
          const running = activeSession(state);
          if (running && running.id !== event.sessionId) {
            return { id, status: "rejected", code: "active_exists", message: "A session is already running.", conflictingSessionId: running.id };
          }
          return { id, status: "rejected", code: "validation", message: "This id is already used." };
        }
        case "chronology":
          return { id, status: "rejected", code: "chronology", message: outcome.message };
        case "forbidden":
          return { id, status: "rejected", code: "forbidden", message: FORBIDDEN };
        case "error":
          logEvent("error", "sync.commit_failed", { user_id: userId, event_id: id, session_id: event.sessionId, type: event.type, code: outcome.code });
          return { id, status: "rejected", code: "server", message: SERVER_FAILED };
      }
    }
    logEvent("warn", "sync.commit_raced", { user_id: userId, event_id: id, session_id: event.sessionId, attempts: MAX_COMMIT_ATTEMPTS });
    return { id, status: "rejected", code: "server", message: RACED };
  };

  for (const [index, p] of parsed.entries()) {
    let result: PushResult;
    if (!p.ok) {
      result = { id: rawId(raws[index], index), status: "rejected", code: "validation", message: p.message };
    } else {
      try {
        result = await pushOne(p.event);
      } catch (error) {
        logEvent("error", "sync.commit_threw", { user_id: userId, event_id: p.event.id, type: p.event.type, message: (error as Error).message.slice(0, 200) });
        result = { id: p.event.id, status: "rejected", code: "server", message: SERVER_FAILED };
      }
    }
    counts[result.status] += 1;
    results.push(result);
  }
  return { results, counts };
}
