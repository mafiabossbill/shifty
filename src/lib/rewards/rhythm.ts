/**
 * The forgiving streak ("rhythm"). Only planned weekdays matter: a planned day with work adds one, an
 * unplanned day is rest and is skipped neutrally (working on it adds nothing — no reward for skipping rest),
 * a missed planned day uses a freeze if one is held, and otherwise the rhythm simply starts again (best is
 * kept). Today never breaks the rhythm while it is still pending. Freezes: one per 7 counted days, max 2.
 */
import { addDays, eachDate, isLocalDate, weekdayOf, type LocalDate } from "@/lib/time/zone";

import type { RhythmInput, RhythmResult, TodayStatus } from "./types";

export const DAYS_PER_FREEZE = 7;
export const MAX_FREEZES = 2;

export function rhythm(input: RhythmInput): RhythmResult {
  const { workDates, today } = input;
  const planned = new Set(input.plannedWeekdays);
  const recorded = new Set(input.freezesUsed ?? []);
  const loggedToday = workDates.has(today);
  const todayStatus: TodayStatus = loggedToday ? "logged" : planned.has(weekdayOf(today)) ? "pending" : "rest";
  const dates = [...workDates].filter((d) => isLocalDate(d) && d <= today).sort();
  const frozenDates: LocalDate[] = [];
  if (dates.length === 0) return { current: 0, best: 0, freezesAvailable: 0, todayStatus, frozenDates };

  let current = 0;
  let best = 0;
  let freezes = 0;
  const step = (date: LocalDate) => {
    if (!planned.has(weekdayOf(date))) return;
    if (workDates.has(date)) {
      current += 1;
      best = Math.max(best, current);
      if (current % DAYS_PER_FREEZE === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
    } else if (freezes > 0) {
      freezes -= 1;
      frozenDates.push(date);
    } else if (recorded.has(date)) {
      frozenDates.push(date);
    } else {
      current = 0;
    }
  };
  for (const date of eachDate(dates[0], addDays(today, -1))) step(date);
  if (loggedToday) step(today);
  return { current, best, freezesAvailable: freezes, todayStatus, frozenDates };
}
