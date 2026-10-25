/** Printable month report: totals, one row per worked day, one row per session. Pure (uses @/lib/reports). */
import { dailyTotals, summarize, type AllocationMode, type SessionFacts } from "@/lib/reports";
import { addDays, daysInMonth, monthKey, type LocalDate } from "@/lib/time/zone";

export interface MonthReport {
  month: string;
  from: LocalDate;
  to: LocalDate;
  mode: AllocationMode;
  netMs: number;
  breakMs: number;
  daysWorked: number;
  sessionCount: number;
  days: { date: LocalDate; netMs: number; breakMs: number; sessions: number }[];
  sessions: SessionFacts[];
}

/** Months (YYYY-MM) that have any time, newest first, always including the current month. */
export function reportMonths(facts: readonly SessionFacts[], today: LocalDate): string[] {
  const set = new Set<string>([monthKey(today)]);
  for (const f of facts) for (const d of f.days) set.add(monthKey(d.date));
  return [...set].sort().reverse();
}

export function monthReport(facts: readonly SessionFacts[], month: string, mode: AllocationMode = "calendar"): MonthReport {
  const from = `${month}-01`;
  const to = addDays(from, daysInMonth(from) - 1);
  const summary = summarize(dailyTotals(facts, mode), { from, to }, mode);
  const ids = new Set(summary.sessionIds);
  return {
    month,
    from,
    to,
    mode,
    netMs: summary.netMs,
    breakMs: summary.breakMs,
    daysWorked: summary.daysWorked,
    sessionCount: ids.size,
    days: summary.series.filter((d) => d.elapsedMs > 0).map((d) => ({ date: d.date, netMs: d.netMs, breakMs: d.breakMs, sessions: d.sessionIds.length })),
    sessions: facts.filter((f) => ids.has(f.session.id)),
  };
}
