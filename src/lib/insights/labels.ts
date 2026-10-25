/** Copy for Insights: range names, mode explanations, neutral deltas and drill-down links. */
import { formatDate, formatDuration, formatMonth, type ClockFormat } from "@/lib/format";
import type { AllocationMode, DateRange } from "@/lib/reports";
import { daysBetween, type LocalDate } from "@/lib/time/zone";

import type { RangeKind } from "./params";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayMonth(date: LocalDate, withYear: boolean): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** "19–25 Oct", "28 Sep – 4 Oct", "October 2026", "2026", "Today". Adds the year when it isn't this year. */
export function rangeLabel(range: DateRange, kind: RangeKind, today: LocalDate): string {
  const thisYear = today.slice(0, 4);
  if (kind === "today" && range.from === today) return "Today";
  if (range.from === range.to) return formatDate(range.from, { thisYear });
  if (kind === "month") return formatMonth(range.from.slice(0, 7));
  if (kind === "year") return range.from.slice(0, 4);
  return spanLabel(range.from, range.to, thisYear);
}

/** "19–25 Oct", "28 Sep – 4 Oct", "28 Dec 2025 – 3 Jan 2026" (year shown when it isn't `thisYear`). */
export function spanLabel(from: LocalDate, to: LocalDate, thisYear: string): string {
  if (from === to) return dayMonth(from, from.slice(0, 4) !== thisYear);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const showYear = !sameYear || to.slice(0, 4) !== thisYear;
  if (sameYear && from.slice(0, 7) === to.slice(0, 7)) {
    return `${Number(from.slice(8, 10))}–${dayMonth(to, showYear)}`;
  }
  return `${dayMonth(from, !sameYear)} – ${dayMonth(to, showYear)}`;
}

/** Days in a range, inclusive. */
export function rangeDays(range: DateRange): number {
  return Math.max(0, daysBetween(range.from, range.to) + 1);
}

export const MODE_OPTIONS: readonly { value: AllocationMode; label: string; short: string }[] = [
  { value: "calendar", label: "Allocate to calendar days", short: "Calendar days" },
  { value: "start", label: "Group by session start date", short: "Start date" },
];

/** One line under the mode toggle; the example uses the person's clock format. */
export function modeExplanation(mode: AllocationMode, clock: ClockFormat = "24h"): string {
  const [from, to] = clock === "12h" ? ["6pm", "10am"] : ["18:00", "10:00"];
  return mode === "calendar"
    ? `A shift from Mon ${from} to Tue ${to} counts 6h on Monday and 10h on Tuesday.`
    : `A shift from Mon ${from} to Tue ${to} counts all 16h on Monday, the day it started.`;
}

/** Neutral sentence for a change in hours: more is not "better". */
export function deltaSentence(deltaMs: number, against: string): string {
  if (!Number.isFinite(deltaMs) || Math.abs(deltaMs) < 60_000) return `The same as ${against}`;
  return `${formatDuration(Math.abs(deltaMs))} ${deltaMs > 0 ? "more" : "less"} than ${against}`;
}

/** The Sessions list reads at most this many ids from `?ids=`. */
export const MAX_DRILL_IDS = 500;

/**
 * Drill-down: one session opens its detail; several open the filtered list. Past MAX_DRILL_IDS the list
 * is opened by date range instead (when one is given), so nothing is silently cut off.
 */
export function sessionsHref(ids: readonly string[], range?: DateRange): string | null {
  if (ids.length === 0) return null;
  if (ids.length === 1) return `/sessions/view?id=${encodeURIComponent(ids[0])}`;
  if (ids.length > MAX_DRILL_IDS && range) return `/sessions?from=${range.from}&to=${range.to}`;
  return `/sessions?ids=${ids.map(encodeURIComponent).join(",")}`;
}

export function sessionHref(id: string): string {
  return `/sessions/view?id=${encodeURIComponent(id)}`;
}

/** "18:00" / "6pm" for a minute of the day. */
export function clockLabel(minuteOfDay: number, clock: ClockFormat = "24h"): string {
  const m = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (clock === "24h") return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${mm ? `:${String(mm).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

/** "12 sessions", "1 session". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
