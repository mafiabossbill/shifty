/**
 * Insights URL state: range, mode, heatmap span and the single-session view all live in the query string,
 * so a view can be shared, bookmarked and restored with the back button. Defaults are omitted from the URL.
 *   ?range=today|week|month|year|custom  (default week)
 *   &date=YYYY-MM-DD   any date inside a preset range (omitted = the range containing today)
 *   &from=…&to=…       custom range (inclusive)
 *   &mode=start        group by session start date (default: allocate to calendar days)
 *   &heat=7|30|90      heatmap span (default 90)
 *   &session=<id>      one session's allocation breakdown instead of a range
 */
import { rangeFor, shiftRange, type AllocationMode, type DateRange, type RangePreset } from "@/lib/reports";
import { addDays, daysBetween, isLocalDate, type LocalDate, type WeekStart } from "@/lib/time/zone";

export type RangeKind = RangePreset | "custom";
export type HeatDays = 7 | 30 | 90;

export const RANGE_KINDS: readonly RangeKind[] = ["today", "week", "month", "year", "custom"];
export const HEAT_DAYS: readonly HeatDays[] = [7, 30, 90];
/** Longest custom range we draw (about three years): keeps every chart cheap and legible. */
export const MAX_CUSTOM_DAYS = 1096;

export interface InsightsParams {
  range: RangeKind;
  date: LocalDate | null;
  from: LocalDate | null;
  to: LocalDate | null;
  mode: AllocationMode;
  heat: HeatDays;
  session: string | null;
}

export const DEFAULT_PARAMS: InsightsParams = { range: "week", date: null, from: null, to: null, mode: "calendar", heat: 90, session: null };

type QueryLike = { get(name: string): string | null };

const SESSION_ID = /^[A-Za-z0-9-]{1,64}$/;

export function parseParams(query: QueryLike): InsightsParams {
  const range = query.get("range");
  const heat = Number(query.get("heat"));
  const date = query.get("date");
  const from = query.get("from");
  const to = query.get("to");
  const session = query.get("session");
  return {
    range: RANGE_KINDS.includes(range as RangeKind) ? (range as RangeKind) : DEFAULT_PARAMS.range,
    date: isLocalDate(date) ? date : null,
    from: isLocalDate(from) ? from : null,
    to: isLocalDate(to) ? to : null,
    mode: query.get("mode") === "start" ? "start" : "calendar",
    heat: HEAT_DAYS.includes(heat as HeatDays) ? (heat as HeatDays) : DEFAULT_PARAMS.heat,
    session: session && SESSION_ID.test(session) ? session : null,
  };
}

/** The query string for a state (no leading "?"); defaults and irrelevant fields are dropped. */
export function toQuery(p: InsightsParams): string {
  const q = new URLSearchParams();
  if (p.session) q.set("session", p.session);
  if (p.range !== DEFAULT_PARAMS.range) q.set("range", p.range);
  if (p.range === "custom") {
    if (p.from) q.set("from", p.from);
    if (p.to) q.set("to", p.to);
  } else if (p.date) q.set("date", p.date);
  if (p.mode !== "calendar") q.set("mode", p.mode);
  if (p.heat !== DEFAULT_PARAMS.heat) q.set("heat", String(p.heat));
  return q.toString();
}

export function insightsHref(p: InsightsParams): string {
  const q = toQuery(p);
  return q ? `/insights?${q}` : "/insights";
}

/** The concrete date range for the params. Custom ranges are ordered and capped; a missing end is today. */
export function resolveRange(p: InsightsParams, today: LocalDate, weekStart: WeekStart): DateRange {
  if (p.range !== "custom") return rangeFor(p.range, p.date ?? today, weekStart);
  let from = p.from ?? addDays(p.to ?? today, -29);
  let to = p.to ?? today;
  if (from > to) [from, to] = [to, from];
  if (daysBetween(from, to) + 1 > MAX_CUSTOM_DAYS) from = addDays(to, -(MAX_CUSTOM_DAYS - 1));
  return { from, to };
}

/** Params for the previous (-1) or next (+1) range of the same kind. Back to "now" drops the date. */
export function stepParams(p: InsightsParams, range: DateRange, steps: number, today: LocalDate, weekStart: WeekStart): InsightsParams {
  const next = shiftRange(range, p.range, steps);
  if (p.range === "custom") return { ...p, from: next.from, to: next.to };
  const current = rangeFor(p.range, today, weekStart);
  return { ...p, date: current.from === next.from ? null : next.from };
}

/** Switching range kind keeps the period the person is looking at (Week of 5 Oct → October). */
export function withRangeKind(p: InsightsParams, kind: RangeKind, range: DateRange, today: LocalDate): InsightsParams {
  if (kind === p.range) return p;
  if (kind === "custom") return { ...p, range: kind, date: null, from: range.from, to: range.to };
  const anchor = today >= range.from && today <= range.to ? null : range.to;
  return { ...p, range: kind, date: anchor, from: null, to: null };
}

/** True when the range already contains today (the "next" arrow then leads into the future). */
export function containsToday(range: DateRange, today: LocalDate): boolean {
  return today >= range.from && today <= range.to;
}
