/**
 * Geometry for the day-split bar (list rows) and the unified timeline (detail): one continuous band from
 * clock-in to clock-out (or now), cut at the local midnights of the session's reporting zone, with breaks
 * as their own parts. Widths are fractions of the elapsed time, so a 25-hour DST day draws wider than a
 * 23-hour one, exactly like the numbers. Pure.
 */
import type { BreakKind } from "@/lib/shifts/types";
import { sessionMetrics, type TimedSession } from "@/lib/time/allocate";
import type { Interval } from "@/lib/time/intervals";
import { localDateOf, nextDayBoundary, type LocalDate } from "@/lib/time/zone";

export interface BandPart {
  kind: "work" | "break";
  start: number;
  end: number;
  /** 0…1 along the band. */
  startFrac: number;
  endFrac: number;
  date: LocalDate;
  /** For breaks: the recorded kind of the break this part belongs to. */
  breakKind?: BreakKind;
}

export interface DayBoundary {
  at: number;
  frac: number;
  /** The date that begins at this boundary. */
  date: LocalDate;
}

export interface DaySpan {
  date: LocalDate;
  startFrac: number;
  endFrac: number;
  netMs: number;
  breakMs: number;
}

export interface DaySplit {
  start: number;
  end: number;
  running: boolean;
  totalMs: number;
  parts: BandPart[];
  boundaries: DayBoundary[];
  days: DaySpan[];
}

type SessionLike = Omit<TimedSession, "breaks"> & { breaks: readonly { startedAt: number; endedAt: number | null; kind?: BreakKind }[] };

function kindAt(session: SessionLike, at: number, end: number): BreakKind | undefined {
  return session.breaks.find((b) => b.startedAt <= at && at < (b.endedAt ?? end))?.kind;
}

export function daySplit(session: SessionLike, now: number): DaySplit {
  const m = sessionMetrics(session, now);
  const start = session.startedAt;
  const end = m.end;
  const totalMs = end - start;
  const frac = (t: number) => (totalMs === 0 ? 0 : (t - start) / totalMs);
  const zone = session.reportingTimeZone;

  const pieces: { kind: "work" | "break"; interval: Interval }[] = [
    ...m.workIntervals.map((interval) => ({ kind: "work" as const, interval })),
    ...m.breakIntervals.map((interval) => ({ kind: "break" as const, interval })),
  ].sort((a, b) => a.interval.start - b.interval.start);

  const parts: BandPart[] = [];
  for (const { kind, interval } of pieces) {
    let cursor = interval.start;
    while (cursor < interval.end) {
      const cut = Math.min(interval.end, nextDayBoundary(cursor, zone));
      const part: BandPart = { kind, start: cursor, end: cut, startFrac: frac(cursor), endFrac: frac(cut), date: localDateOf(cursor, zone) };
      if (kind === "break") part.breakKind = kindAt(session, cursor, end);
      parts.push(part);
      cursor = cut;
    }
  }

  const boundaries: DayBoundary[] = [];
  if (totalMs > 0) {
    for (let b = nextDayBoundary(start, zone); b < end; b = nextDayBoundary(b, zone)) {
      boundaries.push({ at: b, frac: frac(b), date: localDateOf(b, zone) });
    }
  }

  const days: DaySpan[] = [];
  for (const p of parts) {
    let day = days[days.length - 1];
    if (!day || day.date !== p.date) {
      day = { date: p.date, startFrac: p.startFrac, endFrac: p.endFrac, netMs: 0, breakMs: 0 };
      days.push(day);
    }
    day.endFrac = p.endFrac;
    if (p.kind === "work") day.netMs += p.end - p.start;
    else day.breakMs += p.end - p.start;
  }

  return { start, end, running: m.running, totalMs, parts, boundaries, days };
}

export type TimelineItem =
  | { kind: "pin"; pin: "clock_in" | "clock_out" | "now"; at: number }
  | { kind: "work"; start: number; end: number; ms: number; frac: number }
  | { kind: "break"; start: number; end: number; ms: number; frac: number; breakKind?: BreakKind }
  | { kind: "midnight"; at: number; date: LocalDate };

/**
 * The same band as an ordered list, for the vertical (phone) timeline:
 * clock-in · work · midnight · work · break · work · clock-out (or now).
 */
export function timelineItems(split: DaySplit): TimelineItem[] {
  const items: TimelineItem[] = [{ kind: "pin", pin: "clock_in", at: split.start }];
  const boundaryAt = new Map(split.boundaries.map((b) => [b.at, b]));
  for (const p of split.parts) {
    const b = boundaryAt.get(p.start);
    if (b) items.push({ kind: "midnight", at: b.at, date: b.date });
    const frac = p.endFrac - p.startFrac;
    if (p.kind === "work") items.push({ kind: "work", start: p.start, end: p.end, ms: p.end - p.start, frac });
    else items.push({ kind: "break", start: p.start, end: p.end, ms: p.end - p.start, frac, breakKind: p.breakKind });
  }
  items.push({ kind: "pin", pin: split.running ? "now" : "clock_out", at: split.end });
  return items;
}

