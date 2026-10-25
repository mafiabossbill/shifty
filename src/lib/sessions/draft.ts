/**
 * Edit-times and manual-entry drafts. The form holds `<input type="datetime-local">` strings in the
 * session's reporting zone; this turns them into instants (keeping the exact recorded instant when a field
 * wasn't touched, so seconds are never silently dropped) and asks the real reducer whether the change
 * would be accepted — the message the person sees is the reducer's own.
 */
import { correctEvent, manualCreateEvent, type EventContext } from "@/lib/shifts/events";
import { applyEvent } from "@/lib/shifts/reducer";
import type { BreakKind, ShiftBreak, ShiftSession, ShiftState, TimeSnapshot } from "@/lib/shifts/types";
import { addDays, fromWallClockInput, localDateOf, toWallClockInput, wallClock } from "@/lib/time/zone";

export interface BreakDraft {
  id: string;
  kind: BreakKind;
  start: string;
  /** "" = still running (only for the latest break of a running session). */
  end: string;
  original?: ShiftBreak;
}

export interface TimesDraft {
  start: string;
  end: string;
  breaks: BreakDraft[];
}

export function draftFromSession(session: Pick<ShiftSession, "startedAt" | "endedAt" | "breaks">, zone: string): TimesDraft {
  return {
    start: toWallClockInput(session.startedAt, zone),
    end: session.endedAt === null ? "" : toWallClockInput(session.endedAt, zone),
    breaks: session.breaks.map((b) => ({
      id: b.id,
      kind: b.kind,
      start: toWallClockInput(b.startedAt, zone),
      end: b.endedAt === null ? "" : toWallClockInput(b.endedAt, zone),
      original: b,
    })),
  };
}

/** The instant for a field: the original instant when the text still shows it, otherwise the parsed value. */
export function resolveInput(value: string, original: number | null | undefined, zone: string): number | null {
  if (original !== null && original !== undefined && value === toWallClockInput(original, zone)) return original;
  return fromWallClockInput(value, zone);
}

export type FieldKey = "start" | "end" | `break:${string}:start` | `break:${string}:end`;

export type Resolved = { ok: true; snapshot: TimeSnapshot } | { ok: false; field: FieldKey; message: string };

/**
 * Parses a draft. `running` sessions keep `endedAt: null` and may leave the latest break open.
 * `original` supplies the recorded instants for untouched fields.
 */
export function resolveDraft(draft: TimesDraft, zone: string, opts: { running: boolean; original?: Pick<ShiftSession, "startedAt" | "endedAt"> }): Resolved {
  const startedAt = resolveInput(draft.start, opts.original?.startedAt, zone);
  if (startedAt === null) return { ok: false, field: "start", message: "Enter a start date and time." };
  let endedAt: number | null = null;
  if (!opts.running) {
    endedAt = resolveInput(draft.end, opts.original?.endedAt, zone);
    if (endedAt === null) return { ok: false, field: "end", message: "Enter an end date and time." };
  }
  const breaks: ShiftBreak[] = [];
  for (const b of draft.breaks) {
    const s = resolveInput(b.start, b.original?.startedAt, zone);
    if (s === null) return { ok: false, field: `break:${b.id}:start`, message: "Enter when the break started." };
    let e: number | null = null;
    if (b.end === "") {
      if (!opts.running) return { ok: false, field: `break:${b.id}:end`, message: "Enter when the break ended." };
    } else {
      e = resolveInput(b.end, b.original?.endedAt, zone);
      if (e === null) return { ok: false, field: `break:${b.id}:end`, message: "Enter when the break ended." };
    }
    const same = b.original && b.original.startedAt === s && b.original.endedAt === e && b.original.kind === b.kind;
    // An untouched break is passed through as recorded (same object shape), so "nothing changed" is exact.
    breaks.push(same ? { ...b.original! } : { id: b.id, startedAt: s, endedAt: e, kind: b.kind });
  }
  return { ok: true, snapshot: { startedAt, endedAt, breaks } };
}

export type Verdict =
  | { status: "ok" }
  | { status: "unchanged"; message: string }
  | { status: "error"; message: string }
  /** Only the overlap stands in the way; saving with `allowOverlap` would work. */
  | { status: "overlap"; message: string; conflictingSessionId: string | null };

const PREVIEW_REASON = "preview";
const DRAFT_ID = "00000000-0000-4000-8000-00000000d1af";

function draftCtx(now: number, deviceTimeZone: string): EventContext {
  return { now, deviceTimeZone, newId: () => DRAFT_ID };
}

/** Would `store.correct` accept these times? (The reason is checked separately; see `reasonProblem`.) */
export function sameTimes(a: TimeSnapshot, b: TimeSnapshot): boolean {
  const key = (t: TimeSnapshot) =>
    JSON.stringify([t.startedAt, t.endedAt, [...t.breaks].sort((x, y) => x.startedAt - y.startedAt).map((x) => [x.id, x.startedAt, x.endedAt, x.kind])]);
  return key(a) === key(b);
}

export function checkCorrection(state: ShiftState, session: ShiftSession, snapshot: TimeSnapshot, now: number, deviceTimeZone: string): Verdict {
  if (sameTimes(session, snapshot)) return { status: "unchanged", message: "Change a time to save a correction." };
  const running = session.endedAt === null;
  const input = {
    reason: PREVIEW_REASON,
    expectedRevision: session.revision,
    startedAt: snapshot.startedAt,
    breaks: snapshot.breaks,
    ...(running ? {} : { endedAt: snapshot.endedAt }),
  };
  const result = applyEvent(state, correctEvent(draftCtx(now, deviceTimeZone), session.id, input));
  if (result.ok) return { status: "ok" };
  if (result.error.message === "Nothing changed.") return { status: "unchanged", message: "Change a time to save a correction." };
  if (result.error.code === "overlap") {
    const again = applyEvent(state, correctEvent(draftCtx(now, deviceTimeZone), session.id, { ...input, allowOverlap: true }));
    if (again.ok) return { status: "overlap", message: result.error.message, conflictingSessionId: result.error.conflictingSessionId ?? null };
    return { status: "error", message: again.error.message };
  }
  return { status: "error", message: result.error.message };
}

export function reasonProblem(reason: string): string | null {
  return reason.trim().length < 3 ? "Say briefly why you're correcting the times." : null;
}

/** Would `store.manualCreate` accept this missed session? Also refuses an end in the future. */
export function checkManual(state: ShiftState, snapshot: TimeSnapshot, zone: string, goalSeconds: number, now: number, deviceTimeZone: string): Verdict {
  if (snapshot.endedAt === null) return { status: "error", message: "Enter an end date and time." };
  if (snapshot.endedAt > now) return { status: "error", message: "A missed session must have ended already. Use Clock in for one that's still going." };
  const input = { startedAt: snapshot.startedAt, endedAt: snapshot.endedAt, breaks: snapshot.breaks, goalSeconds, reportingTimeZone: zone };
  const result = applyEvent(state, manualCreateEvent(draftCtx(now, deviceTimeZone), input));
  if (result.ok) return { status: "ok" };
  if (result.error.code === "overlap") {
    const again = applyEvent(state, manualCreateEvent(draftCtx(now, deviceTimeZone), { ...input, allowOverlap: true }));
    if (again.ok) return { status: "overlap", message: result.error.message, conflictingSessionId: result.error.conflictingSessionId ?? null };
    return { status: "error", message: again.error.message };
  }
  return { status: "error", message: result.error.message };
}

/** A gentle check, not a rule: longer than a day is usually a wrong date. */
export function longSessionWarning(snapshot: TimeSnapshot): string | null {
  if (snapshot.endedAt === null) return null;
  return snapshot.endedAt - snapshot.startedAt > 24 * 3_600_000 ? "That's longer than a day — check the dates." : null;
}

/**
 * Starting values for a forgotten session: 09:00–17:00 today once 17:00 has passed in `zone`, otherwise
 * the same hours yesterday.
 */
export function defaultManualTimes(now: number, zone: string): { start: string; end: string } {
  const today = localDateOf(now, zone);
  const date = wallClock(now, zone).hour >= 17 ? today : addDays(today, -1);
  return { start: `${date}T09:00`, end: `${date}T17:00` };
}

/** A new break in the middle of the draft session (30 minutes, clamped inside it). */
export function suggestBreak(snapshot: Pick<TimeSnapshot, "startedAt" | "endedAt">, now: number, zone: string, id: string): BreakDraft {
  const end = snapshot.endedAt ?? now;
  const mid = snapshot.startedAt + Math.max(0, Math.floor((end - snapshot.startedAt) / 2));
  const minute = 60_000;
  const start = Math.floor(mid / minute) * minute;
  const stop = Math.min(end, start + 30 * minute);
  return { id, kind: "rest", start: toWallClockInput(start, zone), end: toWallClockInput(stop, zone) };
}
