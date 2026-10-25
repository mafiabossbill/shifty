/**
 * Session time accounting (TRD §3.5). A session is one continuous interval; calendar days are derived
 * buckets. Net work = session interval minus the union of its breaks (clipped to the session); each work
 * interval is split at local-day boundaries of the session's reporting zone. Integer milliseconds
 * throughout, so Σ day.netMs === netMs and Σ day.elapsedMs === elapsedMs exactly.
 * Independent of rewards and charts: they consume these numbers, never the other way round.
 */
import { clip, subtract, totalDuration, union, type Interval } from "./intervals";
import { localDateOf, nextDayBoundary, type LocalDate } from "./zone";

export interface TimedBreak {
  startedAt: number;
  endedAt: number | null;
}

export interface TimedSession {
  startedAt: number;
  endedAt: number | null;
  breaks: readonly TimedBreak[];
  reportingTimeZone: string;
}

export interface SessionMetrics {
  /** Effective end: endedAt, or `now` for a running session (never before the start). */
  end: number;
  running: boolean;
  elapsedMs: number;
  breakMs: number;
  netMs: number;
  /** Breaks clipped to the session and merged. */
  breakIntervals: Interval[];
  workIntervals: Interval[];
  /** `now` was before the start (device clock behind): shown as 0, flagged, never "fixed" silently. */
  clockBehind: boolean;
}

export function sessionMetrics(session: TimedSession, now: number): SessionMetrics {
  const running = session.endedAt === null;
  const rawEnd = session.endedAt ?? now;
  const clockBehind = running && now < session.startedAt;
  const end = Math.max(rawEnd, session.startedAt);
  const bounds = { start: session.startedAt, end };
  const breakIntervals = union(
    session.breaks
      .map((b) => clip({ start: b.startedAt, end: b.endedAt ?? end }, bounds))
      .filter((i): i is Interval => i !== null),
  );
  const workIntervals = subtract(bounds, breakIntervals);
  const elapsedMs = end - session.startedAt;
  const breakMs = totalDuration(breakIntervals);
  return { end, running, elapsedMs, breakMs, netMs: elapsedMs - breakMs, breakIntervals, workIntervals, clockBehind };
}

export interface DayAllocation {
  date: LocalDate;
  netMs: number;
  breakMs: number;
  elapsedMs: number;
}

/** Splits intervals at local-day boundaries and sums each piece into its local date. */
export function splitByLocalDay(intervals: readonly Interval[], timeZone: string): Map<LocalDate, number> {
  const out = new Map<LocalDate, number>();
  for (const interval of intervals) {
    let cursor = interval.start;
    while (cursor < interval.end) {
      const date = localDateOf(cursor, timeZone);
      const segmentEnd = Math.min(interval.end, nextDayBoundary(cursor, timeZone));
      out.set(date, (out.get(date) ?? 0) + (segmentEnd - cursor));
      cursor = segmentEnd;
    }
  }
  return out;
}

/**
 * Day-by-day contribution of one session in its reporting zone, oldest first. Only dates the session
 * actually touches (elapsed > 0) appear: no ghost rows. A running session is allocated up to `now`.
 */
export function allocateByDay(session: TimedSession, now: number, metrics = sessionMetrics(session, now)): DayAllocation[] {
  const zone = session.reportingTimeZone;
  const elapsed = splitByLocalDay([{ start: session.startedAt, end: metrics.end }], zone);
  const net = splitByLocalDay(metrics.workIntervals, zone);
  return [...elapsed.keys()].sort().map((date) => {
    const elapsedMs = elapsed.get(date) ?? 0;
    const netMs = net.get(date) ?? 0;
    return { date, netMs, elapsedMs, breakMs: elapsedMs - netMs };
  });
}

/** The session's anchor date: the local date of its start in its reporting zone. */
export function anchorDate(session: Pick<TimedSession, "startedAt" | "reportingTimeZone">): LocalDate {
  return localDateOf(session.startedAt, session.reportingTimeZone);
}

export interface GoalProgress {
  goalMs: number;
  /** 0…1, capped: the ring never draws past full. */
  ratio: number;
  overageMs: number;
  remainingMs: number;
  /** When the goal is reached at the current pace (running, not on break), else null. */
  predictedFinishAt: number | null;
}

export function goalProgress(netMs: number, goalSeconds: number, now: number, working: boolean): GoalProgress {
  const goalMs = Math.max(0, goalSeconds) * 1000;
  const remainingMs = Math.max(0, goalMs - netMs);
  return {
    goalMs,
    ratio: goalMs === 0 ? 1 : Math.min(1, netMs / goalMs),
    overageMs: Math.max(0, netMs - goalMs),
    remainingMs,
    predictedFinishAt: working && remainingMs > 0 ? now + remainingMs : null,
  };
}
