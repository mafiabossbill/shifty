/**
 * The Insights view model: one pure function from session facts + the URL state to everything the screen
 * draws. All maths comes from `@/lib/reports`; this file only shapes it for charts (series, grids, rows)
 * and keeps the drill-down ids next to every number. Both modes reconcile: every total here is derived
 * from the same per-date totals of the selected mode.
 */
import {
  buckets as reportBuckets,
  contributionsOn,
  dailyTotals,
  durationStats,
  earnings as reportEarnings,
  heatmap,
  monthComparison,
  placeBreakdown,
  records as reportRecords,
  summarize,
  type AllocationMode,
  type Bucket,
  type DateRange,
  type DayContribution,
  type DayTotal,
  type DurationStats,
  type Earnings,
  type PlaceTotal,
  type RangeSummary,
  type SessionFacts,
} from "@/lib/reports";
import {
  addDays,
  daysBetween,
  daysInMonth,
  eachDate,
  localDateOf,
  monthKey,
  nextDayBoundary,
  startOfLocalDay,
  startOfMonth,
  startOfWeek,
  wallClock,
  weekdayOf,
  type LocalDate,
  type WeekStart,
} from "@/lib/time/zone";

import { rangeDays } from "./labels";
import type { HeatDays, RangeKind } from "./params";

const H = 3_600_000;

export interface InsightsInput {
  facts: readonly SessionFacts[];
  range: DateRange;
  kind: RangeKind;
  mode: AllocationMode;
  today: LocalDate;
  weekStart: WeekStart;
  heatDays: HeatDays;
  /** The person's default goal: the dashed reference on per-day charts. */
  defaultGoalMs: number;
  /** Pay tracking on in settings (earnings card shows even before any rated session). */
  payTracking: boolean;
}

/* ---------- A. Hours in motion ---------- */

export interface RingDatum {
  key: string;
  from: LocalDate;
  to: LocalDate;
  netMs: number;
  breakMs: number;
  goalMs: number;
  sessionIds: string[];
  isToday: boolean;
}

export interface RingModel {
  /** ≤7 values: concentric rings (one per day); more: radial bars around the total. */
  form: "rings" | "spokes";
  unit: "day" | "week";
  data: RingDatum[];
  /** A full ring = the goal (rings); a full-length bar = max(biggest value, goal) (spokes). */
  scaleMs: number;
  /** Dashed reference (the default goal) for per-day forms; null for weekly spokes. */
  referenceMs: number | null;
}

/* ---------- B. Day-split ribbon ---------- */

export interface RibbonSegment {
  /** Hours from local midnight of the session's start date (its reporting zone). */
  fromH: number;
  toH: number;
  date: LocalDate;
  /** 0 = the start date, 1 = the next local date… (alternating tints). */
  dayIndex: number;
}

export interface RibbonRow {
  sessionId: string;
  title: string;
  anchor: LocalDate;
  zone: string;
  startedAt: number;
  end: number;
  running: boolean;
  startH: number;
  endH: number;
  segments: RibbonSegment[];
  /** Break gaps (hours from the same origin). */
  breaks: { fromH: number; toH: number }[];
  days: { date: LocalDate; netMs: number; breakMs: number; elapsedMs: number }[];
  netMs: number;
  breakMs: number;
}

export interface RibbonModel {
  rows: RibbonRow[];
  /** Sessions in the range not drawn (only the most recent MAX_RIBBON_ROWS are). */
  hidden: number;
  axis: { fromH: number; toH: number; ticks: { h: number; midnight: boolean }[] };
}

export const MAX_RIBBON_ROWS = 31;

/* ---------- C. Heatmap ---------- */

export interface HeatSlot {
  date: LocalDate;
  netMs: number;
  level: 0 | 1 | 2 | 3 | 4;
  sessionIds: string[];
  /** Before the heatmap's first day or after its last (alignment padding): drawn empty, not clickable. */
  outside: boolean;
}

export interface HeatGrid {
  end: LocalDate;
  days: number;
  /** Weekday index (0 = Sunday) of each column, starting at the week start. */
  weekdays: number[];
  rows: { weekOf: LocalDate; monthLabel: string | null; slots: HeatSlot[] }[];
  totalMs: number;
  activeDays: number;
}

/* ---------- D. Bars ---------- */

export interface BarDatum extends Bucket {
  isToday: boolean;
}

export interface BarsModel {
  unit: "day" | "week" | "month";
  /** The bars' own range (Today shows the last 7 days for context). */
  range: DateRange;
  /** True when the bars cover exactly the selected range (their total equals the hero total). */
  matchesRange: boolean;
  data: BarDatum[];
  totalMs: number;
}

/* ---------- E. Month calendar ---------- */

export interface CalendarCell {
  date: LocalDate;
  inMonth: boolean;
  netMs: number;
  level: 0 | 1 | 2 | 3 | 4;
  sessionIds: string[];
  contributions: DayContribution[];
  /** Some of this date's time comes from a session that started on an earlier date (calendar mode). */
  startedEarlier: boolean;
  isToday: boolean;
  future: boolean;
}

export interface CalendarModel {
  month: string;
  weekdays: number[];
  weeks: CalendarCell[][];
  totalMs: number;
}

/* ---------- F–L ---------- */

export interface ClockInModel {
  hours: { hour: number; count: number; sessionIds: string[] }[];
  total: number;
  /** Circular mean start, rounded to 15 minutes; null with no sessions or when starts are spread out. */
  typicalMinute: number | null;
  spread: boolean;
}

export interface RecordsModel {
  sessions: string[];
  netMs: number;
  breakMs: number;
  longest: { sessionId: string; netMs: number; title: string; anchor: LocalDate } | null;
  bestDay: { date: LocalDate; netMs: number; sessionIds: string[] } | null;
  goal: { reached: number; completed: number; ratio: number | null; reachedIds: string[] };
  crossMidnight: string[];
}

export interface ComparisonModel {
  current: { from: LocalDate; to: LocalDate; netMs: number; sessionIds: string[] };
  previous: { from: LocalDate; to: LocalDate; netMs: number; sessionIds: string[] };
  deltaMs: number;
  deltaRatio: number | null;
}

export interface PlaceRow extends PlaceTotal {
  share: number;
}

export interface InsightsModel {
  mode: AllocationMode;
  range: DateRange;
  summary: RangeSummary;
  /** The same range in the other mode: differs only when a session crosses the range edge. */
  otherMode: { mode: AllocationMode; netMs: number };
  ring: RingModel;
  ribbon: RibbonModel;
  heat: HeatGrid;
  bars: BarsModel;
  calendar: CalendarModel;
  clockIn: ClockInModel;
  durations: DurationStats;
  records: RecordsModel;
  comparison: ComparisonModel;
  places: { rows: PlaceRow[]; anyCaptured: boolean; total: number };
  earnings: { show: boolean; rows: Earnings[] };
  hasAnyData: boolean;
}

/* ---------- helpers ---------- */

function idsOver(daily: Map<LocalDate, DayTotal>, from: LocalDate, to: LocalDate): string[] {
  const out = new Set<string>();
  for (const date of eachDate(from, to)) for (const id of daily.get(date)?.sessionIds ?? []) out.add(id);
  return [...out];
}

const anchoredIn = (f: SessionFacts, range: DateRange) => f.anchor >= range.from && f.anchor <= range.to;

/** 0…4 relative to `max` (same rule as the report heatmap). */
export function levelOf(netMs: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (!(netMs > 0) || !(max > 0)) return 0;
  return Math.min(4, Math.max(1, Math.ceil((netMs / max) * 4))) as 1 | 2 | 3 | 4;
}

export function barUnit(kind: RangeKind, days: number): "day" | "week" | "month" {
  if (kind === "today" || kind === "week") return "day";
  if (kind === "month" || kind === "year") return "week";
  return days <= 14 ? "day" : days <= 190 ? "week" : "month";
}

/** The month the calendar shows: today's month when the range contains it, else the nearest edge. */
export function calendarMonth(range: DateRange, today: LocalDate): LocalDate {
  const pick = today < range.from ? range.from : today > range.to ? range.to : today;
  return startOfMonth(pick);
}

/* ---------- builders ---------- */

export function buildRing(daily: Map<LocalDate, DayTotal>, facts: readonly SessionFacts[], input: InsightsInput): RingModel {
  const { range, today, weekStart, defaultGoalMs } = input;
  const days = rangeDays(range);
  const unit = days > 400 ? "week" : "day";
  const data: RingDatum[] = reportBuckets(daily, facts, range, unit, weekStart).map((b) => ({
    key: b.key,
    from: b.from,
    to: b.to,
    netMs: b.netMs,
    breakMs: b.breakMs,
    goalMs: b.goalMs,
    sessionIds: b.sessionIds,
    isToday: today >= b.from && today <= b.to,
  }));
  const maxNet = Math.max(0, ...data.map((d) => d.netMs));
  const referenceMs = unit === "day" ? defaultGoalMs : null;
  const form = data.length <= 7 ? "rings" : "spokes";
  // Rings read like the Home ring: a full ring is the goal (capped; exact values in the readout).
  // Radial bars scale to the busiest value so the shape of the range shows.
  const scaleMs = form === "rings" && referenceMs ? Math.max(referenceMs, H) : Math.max(maxNet, referenceMs ?? 0, H);
  return { form, unit, data, scaleMs, referenceMs };
}

export function buildRibbon(facts: readonly SessionFacts[], sessionIds: readonly string[]): RibbonModel {
  const wanted = new Set(sessionIds);
  const all = facts.filter((f) => wanted.has(f.session.id) && f.metrics.elapsedMs > 0).sort((a, b) => a.session.startedAt - b.session.startedAt);
  const shown = all.slice(-MAX_RIBBON_ROWS);
  const rows = shown.map(ribbonRow);
  let fromH = Math.min(...rows.map((r) => r.startH));
  let toH = Math.max(...rows.map((r) => r.endH));
  if (!Number.isFinite(fromH) || !Number.isFinite(toH)) {
    fromH = 0;
    toH = 24;
  }
  const span = toH - fromH;
  const step = span > 30 ? 6 : span > 12 ? 3 : span > 6 ? 2 : 1;
  fromH = Math.floor(fromH / step) * step;
  toH = Math.max(fromH + step, Math.ceil(toH / step) * step);
  const ticks: RibbonModel["axis"]["ticks"] = [];
  for (let h = fromH; h <= toH + 1e-9; h += step) ticks.push({ h, midnight: h % 24 === 0 });
  return { rows, hidden: all.length - shown.length, axis: { fromH, toH, ticks } };
}

export function ribbonRow(f: SessionFacts): RibbonRow {
  const zone = f.session.reportingTimeZone;
  const origin = startOfLocalDay(f.anchor, zone);
  const toH = (t: number) => (t - origin) / H;
  const segments: RibbonSegment[] = [];
  for (const w of f.metrics.workIntervals) {
    let cursor = w.start;
    while (cursor < w.end) {
      const date = localDateOf(cursor, zone);
      const end = Math.min(w.end, nextDayBoundary(cursor, zone));
      segments.push({ fromH: toH(cursor), toH: toH(end), date, dayIndex: Math.max(0, daysBetween(f.anchor, date)) });
      cursor = end;
    }
  }
  return {
    sessionId: f.session.id,
    title: f.session.title,
    anchor: f.anchor,
    zone,
    startedAt: f.session.startedAt,
    end: f.metrics.end,
    running: f.metrics.running,
    startH: toH(f.session.startedAt),
    endH: toH(f.metrics.end),
    segments,
    breaks: f.metrics.breakIntervals.map((b) => ({ fromH: toH(b.start), toH: toH(b.end) })),
    days: f.days.map((d) => ({ ...d })),
    netMs: f.metrics.netMs,
    breakMs: f.metrics.breakMs,
  };
}

/** Columns: the seven weekdays from the week start. */
export function weekdayColumns(weekStart: WeekStart): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function buildHeat(daily: Map<LocalDate, DayTotal>, end: LocalDate, days: number, weekStart: WeekStart): HeatGrid {
  const cells = heatmap(daily, end, days);
  const first = cells[0]?.date ?? end;
  const byDate = new Map(cells.map((c) => [c.date, c]));
  const rows: HeatGrid["rows"] = [];
  let lastMonth = "";
  for (let weekOf = startOfWeek(first, weekStart); weekOf <= end; weekOf = addDays(weekOf, 7)) {
    const slots: HeatSlot[] = eachDate(weekOf, addDays(weekOf, 6)).map((date) => {
      const c = byDate.get(date);
      return c
        ? { date, netMs: c.netMs, level: c.level, sessionIds: daily.get(date)?.sessionIds ?? [], outside: false }
        : { date, netMs: 0, level: 0, sessionIds: [], outside: true };
    });
    const firstInside = slots.find((s) => !s.outside)?.date ?? weekOf;
    const month = monthKey(firstInside);
    const startsMonth = slots.some((s) => !s.outside && s.date.endsWith("-01"));
    let monthLabel: string | null = null;
    if (month !== lastMonth || startsMonth) {
      const labelDate = startsMonth ? slots.find((s) => !s.outside && s.date.endsWith("-01"))!.date : firstInside;
      const key = monthKey(labelDate);
      if (key !== lastMonth) monthLabel = MONTH_SHORT[Number(key.slice(5, 7)) - 1];
      lastMonth = key;
    }
    rows.push({ weekOf, monthLabel, slots });
  }
  return {
    end,
    days,
    weekdays: weekdayColumns(weekStart),
    rows,
    totalMs: cells.reduce((s, c) => s + c.netMs, 0),
    activeDays: cells.filter((c) => c.netMs > 0).length,
  };
}

export function buildBars(daily: Map<LocalDate, DayTotal>, facts: readonly SessionFacts[], input: InsightsInput): BarsModel {
  const { kind, range, today, weekStart } = input;
  const own = kind === "today" ? { from: addDays(today, -6), to: today } : range;
  const unit = barUnit(kind, rangeDays(range));
  const todayKey = unit === "day" ? today : unit === "week" ? startOfWeek(today, weekStart) : monthKey(today);
  const data = reportBuckets(daily, facts, own, unit, weekStart).map((b) => ({ ...b, isToday: b.key === todayKey && today >= b.from && today <= b.to }));
  return { unit, range: own, matchesRange: own.from === range.from && own.to === range.to, data, totalMs: data.reduce((s, b) => s + b.netMs, 0) };
}

export function buildCalendar(facts: readonly SessionFacts[], daily: Map<LocalDate, DayTotal>, input: InsightsInput): CalendarModel {
  const { mode, today, weekStart, range } = input;
  const first = calendarMonth(range, today);
  const last = addDays(first, daysInMonth(first) - 1);
  const gridFrom = startOfWeek(first, weekStart);
  const gridTo = addDays(startOfWeek(last, weekStart), 6);
  const dates = eachDate(gridFrom, gridTo);
  const inMonth = (d: LocalDate) => d >= first && d <= last;
  const max = Math.max(0, ...eachDate(first, last).map((d) => daily.get(d)?.netMs ?? 0));
  const cells: CalendarCell[] = dates.map((date) => {
    const t = daily.get(date);
    const contributions: DayContribution[] = !inMonth(date)
      ? []
      : mode === "calendar"
        ? contributionsOn(facts, date)
        : facts
            .filter((f) => f.anchor === date && f.metrics.elapsedMs > 0)
            .map((f) => ({ sessionId: f.session.id, netMs: f.metrics.netMs, breakMs: f.metrics.breakMs, startedEarlier: false, anchor: f.anchor }));
    return {
      date,
      inMonth: inMonth(date),
      netMs: inMonth(date) ? (t?.netMs ?? 0) : 0,
      level: inMonth(date) ? levelOf(t?.netMs ?? 0, max) : 0,
      sessionIds: inMonth(date) ? (t?.sessionIds ?? []) : [],
      contributions,
      startedEarlier: mode === "calendar" && contributions.some((c) => c.startedEarlier),
      isToday: date === today,
      future: date > today,
    };
  });
  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { month: monthKey(first), weekdays: weekdayColumns(weekStart), weeks, totalMs: cells.reduce((s, c) => s + c.netMs, 0) };
}

/**
 * The typical clock-in: find the busiest 3-hour window (circular, so 23:00–01:00 is one window), then take
 * the circular mean of the starts within ±3h of it (so 23:00 and 01:00 average to midnight, not noon),
 * rounded to 15 min. With two habits (mornings and evenings) this names the main one instead of a time
 * in between. `spread` when even the main cluster holds under 40% of starts.
 */
export function typicalStart(minutes: readonly number[]): { minute: number | null; spread: boolean } {
  if (minutes.length === 0) return { minute: null, spread: false };
  const hours = new Array<number>(24).fill(0);
  for (const m of minutes) hours[Math.floor((((m % 1440) + 1440) % 1440) / 60)]++;
  let peak = 0;
  let best = -1;
  for (let h = 0; h < 24; h++) {
    const c = hours[(h + 23) % 24] + hours[h] + hours[(h + 1) % 24];
    if (c > best) {
      best = c;
      peak = h;
    }
  }
  const centre = peak * 60 + 30;
  const dist = (m: number) => Math.min(Math.abs(m - centre), 1440 - Math.abs(m - centre));
  const cluster = minutes.filter((m) => dist(((m % 1440) + 1440) % 1440) <= 180);
  if (cluster.length / minutes.length < 0.4) return { minute: null, spread: true };
  let x = 0;
  let y = 0;
  for (const m of cluster) {
    const a = (m / 1440) * 2 * Math.PI;
    x += Math.cos(a);
    y += Math.sin(a);
  }
  const angle = (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI);
  const minute = (Math.round(((angle / (2 * Math.PI)) * 1440) / 15) * 15) % 1440;
  return { minute, spread: false };
}

export function buildClockIn(facts: readonly SessionFacts[], range: DateRange): ClockInModel {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, sessionIds: [] as string[] }));
  const minutes: number[] = [];
  for (const f of facts) {
    if (!anchoredIn(f, range)) continue;
    const h = hours[f.startHour];
    h.count++;
    h.sessionIds.push(f.session.id);
    const w = wallClock(f.session.startedAt, f.session.reportingTimeZone);
    minutes.push(w.hour * 60 + w.minute);
  }
  const t = typicalStart(minutes);
  return { hours, total: minutes.length, typicalMinute: t.minute, spread: t.spread };
}

export function buildRecords(facts: readonly SessionFacts[], summary: RangeSummary, range: DateRange): RecordsModel {
  const r = reportRecords(facts, range);
  const inRange = facts.filter((f) => anchoredIn(f, range));
  const done = inRange.filter((f) => !f.metrics.running);
  const reachedIds = done.filter((f) => f.reachedGoal).map((f) => f.session.id);
  const longestFact = r.longest ? facts.find((f) => f.session.id === r.longest!.sessionId) : undefined;
  let bestDay: RecordsModel["bestDay"] = null;
  for (const d of summary.series) if (d.netMs > 0 && (!bestDay || d.netMs > bestDay.netMs)) bestDay = { date: d.date, netMs: d.netMs, sessionIds: d.sessionIds };
  return {
    sessions: summary.sessionIds,
    netMs: summary.netMs,
    breakMs: summary.breakMs,
    longest: r.longest && longestFact ? { ...r.longest, title: longestFact.session.title, anchor: longestFact.anchor } : null,
    bestDay,
    goal: { reached: reachedIds.length, completed: done.length, ratio: r.goalRatio, reachedIds },
    crossMidnight: inRange.filter((f) => f.crossesMidnight).map((f) => f.session.id),
  };
}

export function buildComparison(daily: Map<LocalDate, DayTotal>, today: LocalDate): ComparisonModel {
  const c = monthComparison(daily, today);
  const day = Number(today.slice(8, 10));
  const thisFrom = startOfMonth(today);
  const prevFrom = `${c.previous.key}-01`;
  const prevTo = addDays(prevFrom, Math.min(day, daysInMonth(prevFrom)) - 1);
  return {
    current: { from: thisFrom, to: today, netMs: c.current.netMs, sessionIds: idsOver(daily, thisFrom, today) },
    previous: { from: prevFrom, to: prevTo, netMs: c.previous.netMs, sessionIds: idsOver(daily, prevFrom, prevTo) },
    deltaMs: c.deltaMs,
    deltaRatio: c.deltaRatio,
  };
}

export function buildInsights(input: InsightsInput): InsightsModel {
  const { facts, range, mode, today, weekStart, heatDays, payTracking } = input;
  const daily = dailyTotals(facts, mode);
  const summary = summarize(daily, range, mode);
  const otherModeKey: AllocationMode = mode === "calendar" ? "start" : "calendar";
  const other = summarize(dailyTotals(facts, otherModeKey), range, otherModeKey);
  const heatEnd = today < range.from ? range.to : today > range.to ? range.to : today;
  const places = placeBreakdown(facts, range);
  const placesTotal = places.reduce((s, p) => s + p.netMs, 0);
  const rated = facts.some((f) => f.session.payRateMinor !== null && f.session.currency);
  return {
    mode,
    range,
    summary,
    otherMode: { mode: otherModeKey, netMs: other.netMs },
    ring: buildRing(daily, facts, input),
    ribbon: buildRibbon(facts, summary.sessionIds),
    heat: buildHeat(daily, heatEnd, heatDays, weekStart),
    bars: buildBars(daily, facts, input),
    calendar: buildCalendar(facts, daily, input),
    clockIn: buildClockIn(facts, range),
    durations: durationStats(facts, range),
    records: buildRecords(facts, summary, range),
    comparison: buildComparison(daily, today),
    places: {
      rows: places.map((p) => ({ ...p, share: placesTotal > 0 ? p.netMs / placesTotal : 0 })),
      anyCaptured: places.some((p) => p.kind !== "not_captured"),
      total: placesTotal,
    },
    earnings: { show: payTracking || rated, rows: reportEarnings(facts, range, mode) },
    hasAnyData: facts.some((f) => f.metrics.elapsedMs > 0),
  };
}

/** One session's allocation (the `?session=` view). */
export interface SessionBreakdown {
  row: RibbonRow;
  axis: RibbonModel["axis"];
  /** Σ days.netMs === row.netMs (the engine's guarantee, shown as the total line). */
  totalNetMs: number;
  startedOn: LocalDate;
  weekday: number;
}

export function buildSessionBreakdown(fact: SessionFacts): SessionBreakdown {
  const ribbon = buildRibbon([fact], [fact.session.id]);
  const row = ribbon.rows[0] ?? ribbonRow(fact);
  return { row, axis: ribbon.axis, totalNetMs: row.days.reduce((s, d) => s + d.netMs, 0), startedOn: fact.anchor, weekday: weekdayOf(fact.anchor) };
}
