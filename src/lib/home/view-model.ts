/**
 * Home view models: pure functions of sessions, settings and `now`. No React, no store — unit-tested in
 * tests/home-view-model.test.ts. Times are always shown in the session's reporting zone.
 */
import { formatDuration, formatDurationParts, formatTime, weekdayShort, type ClockFormat } from "@/lib/format";
import type { LocationFix, ShiftSession } from "@/lib/shifts/types";
import type { DayAllocation } from "@/lib/time/allocate";
import { addDays, localDateOf, wallClock, type LocalDate } from "@/lib/time/zone";
import type { DayTotal } from "@/lib/reports";
import type { MochiStatus } from "@/components/mochi/mood";

const pad = (n: number) => String(n).padStart(2, "0");

/** "Good evening, Bill" / "Good evening" (no name set). Hour is local to the reporting zone. */
export function greetingFor(hour: number, name: string): string {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const part = h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 17 ? "Good afternoon" : h >= 17 && h < 23 ? "Good evening" : "Hello, night owl";
  const clean = name.trim();
  if (!clean) return part;
  return part === "Hello, night owl" ? `Hello, ${clean}` : `${part}, ${clean}`;
}

/** Mochi's status on Home: just_finished for 10 minutes after a clock-out. */
export const JUST_FINISHED_MS = 10 * 60_000;

export function mochiStatusFor(active: ShiftSession | null, last: ShiftSession | null, now: number): MochiStatus {
  if (active) return active.breaks.some((b) => b.endedAt === null) ? "on_break" : "active";
  if (last && last.endedAt !== null && now - last.endedAt >= 0 && now - last.endedAt < JUST_FINISHED_MS) return "just_finished";
  return "idle";
}

/** The newest completed (not deleted) session. `sessions` is newest first. */
export function lastCompleted(sessions: readonly ShiftSession[]): ShiftSession | null {
  return sessions.find((s) => s.endedAt !== null && s.deletedAt === null) ?? null;
}

/** "today", "tomorrow", "yesterday" or a short weekday ("Wed") relative to `today`. */
export function dayWord(date: LocalDate, today: LocalDate): string {
  if (date === today) return "today";
  if (date === addDays(today, 1)) return "tomorrow";
  if (date === addDays(today, -1)) return "yesterday";
  return weekdayShort(date);
}

/** "Goal at 10:14 tomorrow" — the predicted finish, in the session's zone. */
export function goalAtLine(predictedFinishAt: number, now: number, zone: string, clock: ClockFormat): string {
  const date = localDateOf(predictedFinishAt, zone);
  const today = localDateOf(now, zone);
  return `Goal at ${formatTime(predictedFinishAt, zone, clock)} ${dayWord(date, today)}`;
}

/** "Crossed midnight · 6h on Mon, 3h 20m today" — null for a single-day session. The days add up to the net shown. */
export function crossedMidnightLine(days: readonly DayAllocation[], today: LocalDate): string | null {
  const touched = days.filter((d) => d.elapsedMs > 0);
  if (touched.length < 2) return null;
  const amounts = formatDurationParts(touched.map((d) => d.netMs));
  const parts = touched.map((d, i) => {
    const word = dayWord(d.date, today);
    const amount = amounts[i];
    return word === "today" ? `${amount} today` : `${amount} on ${word === "yesterday" ? weekdayShort(d.date) : word}`;
  });
  return `Crossed midnight · ${parts.join(", ")}`;
}

/** Recap per-day split: "Mon 6h · Tue 9h 30m". The days add up to `formatDuration(net)` (apportioned minutes). */
export function daySplitLine(days: readonly DayAllocation[]): string {
  const touched = days.filter((d) => d.elapsedMs > 0);
  const amounts = formatDurationParts(touched.map((d) => d.netMs));
  return touched.map((d, i) => `${weekdayShort(d.date)} ${amounts[i]}`).join(" · ");
}

/** Neutral overage copy. Never praise: "+1h 12m past your goal. Rest well." */
export function overageLine(netMs: number, goalSeconds: number): string | null {
  const over = netMs - goalSeconds * 1000;
  if (goalSeconds <= 0 || over < 60_000) return null;
  return `+${formatDuration(over)} past your goal. Rest well.`;
}

/** The most recent location fix for a session (by request time), or null when none was recorded yet. */
export function latestFix(session: Pick<ShiftSession, "locations">): LocationFix | null {
  let best: LocationFix | null = null;
  for (const f of session.locations) if (!best || f.requestedAt >= best.requestedAt) best = f;
  return best;
}

/** "Office · ±12 m · 18:00:09" for a captured fix. */
export function capturedLocationLine(fix: LocationFix, zone: string): string {
  const parts: string[] = [fix.placeLabel ?? "Location captured"];
  if (fix.accuracyM !== null) parts.push(`±${Math.round(fix.accuracyM)} m`);
  const at = fix.capturedAt ?? fix.requestedAt;
  const w = wallClock(at, zone);
  parts.push(`${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}`);
  return parts.join(" · ");
}

/** Splits a stopwatch readout into the big part and the seconds: "06:42:10" → ["06:42", ":10"]. */
export function splitStopwatch(text: string): [string, string] {
  const i = text.lastIndexOf(":");
  return i <= 0 ? [text, ""] : [text.slice(0, i), text.slice(i)];
}

export interface SparkBar {
  date: LocalDate;
  /** One letter: M T W T F S S. */
  letter: string;
  weekday: string;
  netMs: number;
  /** 0…1 of the tallest bar in the week (0 when no time at all). */
  ratio: number;
  isToday: boolean;
  isFuture: boolean;
}

/** Seven bars for the week series (from `summarize(...).series`), tallest = 1. */
export function weekBars(series: readonly DayTotal[], today: LocalDate): SparkBar[] {
  const max = series.reduce((m, d) => Math.max(m, d.netMs), 0);
  return series.map((d) => {
    const weekday = weekdayShort(d.date);
    return {
      date: d.date,
      letter: weekday.charAt(0),
      weekday,
      netMs: d.netMs,
      ratio: max > 0 ? d.netMs / max : 0,
      isToday: d.date === today,
      isFuture: d.date > today,
    };
  });
}

/** Forgiving rhythm wording. */
export function rhythmLines(r: { current: number; best: number; freezesAvailable: number; todayStatus: "logged" | "pending" | "rest" }): {
  headline: string;
  today: string;
  freezes: string;
} {
  const headline = r.current === 0 ? "A fresh start" : `${r.current}-day rhythm`;
  const today = r.todayStatus === "logged" ? "Today is logged." : r.todayStatus === "rest" ? "Today is a rest day. Enjoy it." : "Today is still open. No pressure.";
  const freezes =
    r.freezesAvailable === 0
      ? "No freezes saved yet. One builds up every 7 days you log."
      : `${r.freezesAvailable} ${r.freezesAvailable === 1 ? "freeze" : "freezes"} saved. A missed day won't break your rhythm.`;
  return { headline, today, freezes };
}

/** Countdown seconds left on the undo window (never negative). */
export function undoSecondsLeft(until: number, now: number): number {
  return Math.max(0, Math.ceil((until - now) / 1000));
}

/** Parses the free-text tag field: "client a, urgent ,, x" → ["client a", "urgent", "x"] (deduped, ≤10). */
export function parseTags(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(",")) {
    const t = raw.trim().slice(0, 32);
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, 10);
}
