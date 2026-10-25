/**
 * Reporting engine: everything Insights shows is derived here from sessions + the time engine, never stored.
 * Two explicit modes, never mixed in one number:
 *  - "calendar": each session's net time is allocated to the local dates it touches (default);
 *  - "start": each session's whole net time counts on its anchor (start) date.
 * In both modes every millisecond of a session is counted exactly once, so totals reconcile with sessions.
 */
import { allocateByDay, anchorDate, sessionMetrics, type DayAllocation, type SessionMetrics } from "@/lib/time/allocate";
import {
  addDays,
  addMonths,
  daysInMonth,
  eachDate,
  monthKey,
  startOfMonth,
  startOfWeek,
  wallClock,
  type LocalDate,
  type WeekStart,
} from "@/lib/time/zone";
import type { ShiftSession } from "@/lib/shifts/types";

export type AllocationMode = "calendar" | "start";
export type RangePreset = "today" | "week" | "month" | "year";

export interface DateRange {
  from: LocalDate;
  to: LocalDate;
}

export interface SessionFacts {
  session: ShiftSession;
  metrics: SessionMetrics;
  days: DayAllocation[];
  anchor: LocalDate;
  /** Local hour (0–23) of clock-in in the session's reporting zone. */
  startHour: number;
  crossesMidnight: boolean;
  reachedGoal: boolean;
}

/** Facts for every visible session (trash excluded; archived sessions still count in reports). */
export function sessionFacts(sessions: readonly ShiftSession[], now: number): SessionFacts[] {
  return sessions
    .filter((s) => s.deletedAt === null)
    .map((session) => {
      const metrics = sessionMetrics(session, now);
      const days = allocateByDay(session, now, metrics);
      return {
        session,
        metrics,
        days,
        anchor: anchorDate(session),
        startHour: wallClock(session.startedAt, session.reportingTimeZone).hour,
        crossesMidnight: days.length > 1,
        reachedGoal: metrics.netMs >= session.goalSeconds * 1000,
      };
    })
    .sort((a, b) => a.session.startedAt - b.session.startedAt);
}

export function rangeFor(preset: RangePreset, today: LocalDate, weekStart: WeekStart): DateRange {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "week": {
      const from = startOfWeek(today, weekStart);
      return { from, to: addDays(from, 6) };
    }
    case "month": {
      const from = startOfMonth(today);
      return { from, to: addDays(from, daysInMonth(from) - 1) };
    }
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
  }
}

export function shiftRange(range: DateRange, preset: RangePreset | "custom", steps: number): DateRange {
  if (preset === "month") {
    const from = addMonths(range.from, steps);
    return { from, to: addDays(from, daysInMonth(from) - 1) };
  }
  if (preset === "year") {
    const year = Number(range.from.slice(0, 4)) + steps;
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  const length = eachDate(range.from, range.to).length;
  return { from: addDays(range.from, steps * length), to: addDays(range.to, steps * length) };
}

export interface DayTotal {
  date: LocalDate;
  netMs: number;
  breakMs: number;
  elapsedMs: number;
  /** Sessions contributing to this date (calendar) or starting on it (start). */
  sessionIds: string[];
}

/** Per-date totals for one mode. Only dates with time appear. */
export function dailyTotals(facts: readonly SessionFacts[], mode: AllocationMode): Map<LocalDate, DayTotal> {
  const out = new Map<LocalDate, DayTotal>();
  const add = (date: LocalDate, netMs: number, breakMs: number, elapsedMs: number, id: string) => {
    const t = out.get(date) ?? { date, netMs: 0, breakMs: 0, elapsedMs: 0, sessionIds: [] };
    t.netMs += netMs;
    t.breakMs += breakMs;
    t.elapsedMs += elapsedMs;
    if (!t.sessionIds.includes(id)) t.sessionIds.push(id);
    out.set(date, t);
  };
  for (const f of facts) {
    if (mode === "start") {
      if (f.metrics.elapsedMs > 0) add(f.anchor, f.metrics.netMs, f.metrics.breakMs, f.metrics.elapsedMs, f.session.id);
    } else {
      for (const d of f.days) add(d.date, d.netMs, d.breakMs, d.elapsedMs, f.session.id);
    }
  }
  return out;
}

export interface RangeSummary {
  range: DateRange;
  mode: AllocationMode;
  netMs: number;
  breakMs: number;
  elapsedMs: number;
  /** Distinct sessions contributing to the range. */
  sessionIds: string[];
  daysWorked: number;
  /** One entry per date in the range (zeros included, for charts). */
  series: DayTotal[];
}

export function summarize(daily: Map<LocalDate, DayTotal>, range: DateRange, mode: AllocationMode): RangeSummary {
  const series = eachDate(range.from, range.to).map((date) => daily.get(date) ?? { date, netMs: 0, breakMs: 0, elapsedMs: 0, sessionIds: [] });
  const ids = new Set<string>();
  let netMs = 0;
  let breakMs = 0;
  let elapsedMs = 0;
  let daysWorked = 0;
  for (const d of series) {
    netMs += d.netMs;
    breakMs += d.breakMs;
    elapsedMs += d.elapsedMs;
    if (d.netMs > 0) daysWorked++;
    for (const id of d.sessionIds) ids.add(id);
  }
  return { range, mode, netMs, breakMs, elapsedMs, sessionIds: [...ids], daysWorked, series };
}

export interface Bucket {
  key: string;
  from: LocalDate;
  to: LocalDate;
  netMs: number;
  breakMs: number;
  /** Σ goals of sessions anchored in the bucket — the target overlay. */
  goalMs: number;
  sessionIds: string[];
}

/** Groups a date range into weeks or months (exact: these boundaries are day boundaries). */
export function buckets(
  daily: Map<LocalDate, DayTotal>,
  facts: readonly SessionFacts[],
  range: DateRange,
  unit: "day" | "week" | "month",
  weekStart: WeekStart,
): Bucket[] {
  const keyOf = (date: LocalDate) => (unit === "day" ? date : unit === "week" ? startOfWeek(date, weekStart) : monthKey(date));
  const out = new Map<string, Bucket>();
  for (const date of eachDate(range.from, range.to)) {
    const key = keyOf(date);
    const b = out.get(key) ?? { key, from: date, to: date, netMs: 0, breakMs: 0, goalMs: 0, sessionIds: [] };
    b.to = date;
    const t = daily.get(date);
    if (t) {
      b.netMs += t.netMs;
      b.breakMs += t.breakMs;
      for (const id of t.sessionIds) if (!b.sessionIds.includes(id)) b.sessionIds.push(id);
    }
    out.set(key, b);
  }
  for (const f of facts) {
    if (f.anchor < range.from || f.anchor > range.to) continue;
    const b = out.get(keyOf(f.anchor));
    if (b) b.goalMs += f.session.goalSeconds * 1000;
  }
  return [...out.values()];
}

export interface HeatCell {
  date: LocalDate;
  netMs: number;
  /** 0 (none) … 4 (most), relative to the range's busiest day. */
  level: 0 | 1 | 2 | 3 | 4;
}

export function heatmap(daily: Map<LocalDate, DayTotal>, end: LocalDate, days: number): HeatCell[] {
  const dates = eachDate(addDays(end, -(days - 1)), end);
  const max = Math.max(0, ...dates.map((d) => daily.get(d)?.netMs ?? 0));
  return dates.map((date) => {
    const netMs = daily.get(date)?.netMs ?? 0;
    const level = netMs === 0 || max === 0 ? 0 : (Math.min(4, Math.ceil((netMs / max) * 4)) as 1 | 2 | 3 | 4);
    return { date, netMs, level };
  });
}

/** Clock-in count per local hour (sessions starting in the range). */
export function clockInHours(facts: readonly SessionFacts[], range?: DateRange): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const f of facts) if (!range || (f.anchor >= range.from && f.anchor <= range.to)) hours[f.startHour]++;
  return hours;
}

export interface DurationStats {
  /** Completed-session counts per 2-hour net bucket: [0–2h, 2–4h, …, 18–20h, 20h+]. */
  histogram: { label: string; fromH: number; toH: number | null; count: number; sessionIds: string[] }[];
  meanMs: number;
  medianMs: number;
  count: number;
}

export function durationStats(facts: readonly SessionFacts[], range?: DateRange): DurationStats {
  const done = facts.filter((f) => !f.metrics.running && (!range || (f.anchor >= range.from && f.anchor <= range.to)));
  const histogram = Array.from({ length: 11 }, (_, i) => ({
    label: i === 10 ? "20h+" : `${i * 2}–${i * 2 + 2}h`,
    fromH: i * 2,
    toH: i === 10 ? null : i * 2 + 2,
    count: 0,
    sessionIds: [] as string[],
  }));
  for (const f of done) {
    const b = histogram[Math.min(10, Math.floor(f.metrics.netMs / 7_200_000))];
    b.count++;
    b.sessionIds.push(f.session.id);
  }
  const nets = done.map((f) => f.metrics.netMs).sort((a, b) => a - b);
  const meanMs = nets.length ? Math.round(nets.reduce((s, n) => s + n, 0) / nets.length) : 0;
  const mid = Math.floor(nets.length / 2);
  const medianMs = nets.length === 0 ? 0 : nets.length % 2 ? nets[mid] : Math.round((nets[mid - 1] + nets[mid]) / 2);
  return { histogram, meanMs, medianMs, count: nets.length };
}

export interface Records {
  totalSessions: number;
  totalNetMs: number;
  totalBreakMs: number;
  longest: { sessionId: string; netMs: number } | null;
  /** The calendar date with the most net time (never framed as a target). */
  bestDay: { date: LocalDate; netMs: number } | null;
  /** Completed sessions that reached their own goal / completed sessions. */
  goalRatio: number | null;
  crossMidnightCount: number;
}

export function records(facts: readonly SessionFacts[], range?: DateRange): Records {
  const inRange = facts.filter((f) => !range || (f.anchor >= range.from && f.anchor <= range.to));
  const done = inRange.filter((f) => !f.metrics.running);
  let longest: Records["longest"] = null;
  for (const f of done) if (!longest || f.metrics.netMs > longest.netMs) longest = { sessionId: f.session.id, netMs: f.metrics.netMs };
  let bestDay: Records["bestDay"] = null;
  const daily = dailyTotals(inRange, "calendar");
  for (const d of daily.values()) {
    if (range && (d.date < range.from || d.date > range.to)) continue;
    if (!bestDay || d.netMs > bestDay.netMs) bestDay = { date: d.date, netMs: d.netMs };
  }
  return {
    totalSessions: inRange.length,
    totalNetMs: inRange.reduce((s, f) => s + f.metrics.netMs, 0),
    totalBreakMs: inRange.reduce((s, f) => s + f.metrics.breakMs, 0),
    longest,
    bestDay,
    goalRatio: done.length ? done.filter((f) => f.reachedGoal).length / done.length : null,
    crossMidnightCount: inRange.filter((f) => f.crossesMidnight).length,
  };
}

export interface MonthComparison {
  current: { key: string; netMs: number };
  previous: { key: string; netMs: number };
  deltaMs: number;
  /** null when last month had no time (no meaningful percentage). */
  deltaRatio: number | null;
}

/** This month so far vs the same span of last month (fair: day 1…today vs day 1…same day). */
export function monthComparison(daily: Map<LocalDate, DayTotal>, today: LocalDate): MonthComparison {
  const day = Number(today.slice(8, 10));
  const thisFrom = startOfMonth(today);
  const prevFrom = addMonths(today, -1);
  const prevTo = addDays(prevFrom, Math.min(day, daysInMonth(prevFrom)) - 1);
  const sum = (from: LocalDate, to: LocalDate) => eachDate(from, to).reduce((s, d) => s + (daily.get(d)?.netMs ?? 0), 0);
  const current = sum(thisFrom, today);
  const previous = sum(prevFrom, prevTo);
  return {
    current: { key: monthKey(today), netMs: current },
    previous: { key: monthKey(prevFrom), netMs: previous },
    deltaMs: current - previous,
    deltaRatio: previous === 0 ? null : (current - previous) / previous,
  };
}

export interface PlaceTotal {
  label: string;
  kind: "place" | "unlabelled" | "not_captured";
  netMs: number;
  sessionIds: string[];
}

/** Net time by clock-in place label. Coordinates never leave this function's input. */
export function placeBreakdown(facts: readonly SessionFacts[], range?: DateRange): PlaceTotal[] {
  const out = new Map<string, PlaceTotal>();
  for (const f of facts) {
    if (range && (f.anchor < range.from || f.anchor > range.to)) continue;
    const fix = f.session.locations.find((l) => l.event === "clock_in" && l.status === "captured") ?? null;
    const entry: Pick<PlaceTotal, "label" | "kind"> = !fix
      ? { label: "Not captured", kind: "not_captured" }
      : fix.placeLabel
        ? { label: fix.placeLabel, kind: "place" }
        : { label: "Unlabelled spot", kind: "unlabelled" };
    const key = `${entry.kind}:${entry.label}`;
    const t = out.get(key) ?? { ...entry, netMs: 0, sessionIds: [] };
    t.netMs += f.metrics.netMs;
    t.sessionIds.push(f.session.id);
    out.set(key, t);
  }
  return [...out.values()].sort((a, b) => b.netMs - a.netMs);
}

export interface Earnings {
  currency: string;
  amountMinor: number;
  netMs: number;
}

/**
 * Estimated earnings in the range: net time × each session's hourly rate, per currency, rounded once per
 * currency (half away from zero). An estimate only — no overtime or labour rules are assumed.
 */
export function earnings(facts: readonly SessionFacts[], range: DateRange, mode: AllocationMode): Earnings[] {
  const acc = new Map<string, { scaled: number; netMs: number }>();
  for (const f of facts) {
    const { payRateMinor, currency } = f.session;
    if (payRateMinor === null || !currency) continue;
    const ms =
      mode === "start"
        ? f.anchor >= range.from && f.anchor <= range.to
          ? f.metrics.netMs
          : 0
        : f.days.filter((d) => d.date >= range.from && d.date <= range.to).reduce((s, d) => s + d.netMs, 0);
    if (ms === 0) continue;
    const a = acc.get(currency) ?? { scaled: 0, netMs: 0 };
    a.scaled += ms * payRateMinor;
    a.netMs += ms;
    acc.set(currency, a);
  }
  return [...acc.entries()].map(([currency, a]) => ({ currency, amountMinor: Math.round(a.scaled / 3_600_000), netMs: a.netMs }));
}

export interface DayContribution {
  sessionId: string;
  netMs: number;
  breakMs: number;
  /** The session started on an earlier date (show a backlink to its anchor). */
  startedEarlier: boolean;
  anchor: LocalDate;
}

/** Which sessions put time on a date, for calendar cells and drill-downs. */
export function contributionsOn(facts: readonly SessionFacts[], date: LocalDate): DayContribution[] {
  const out: DayContribution[] = [];
  for (const f of facts) {
    const d = f.days.find((x) => x.date === date);
    if (d) out.push({ sessionId: f.session.id, netMs: d.netMs, breakMs: d.breakMs, startedEarlier: f.anchor < date, anchor: f.anchor });
  }
  return out;
}
