/** Display formatting for times and durations. Instants are always shown in an explicit zone. */
import { localDateOf, parseLocalDate, wallClock, type LocalDate } from "@/lib/time/zone";

export type ClockFormat = "24h" | "12h";

const pad = (n: number) => String(n).padStart(2, "0");

/** Stopwatch readout: 15:30:07 (hours grow past 24, never wrap). */
export function formatStopwatch(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Human duration: "15h 30m", "45m", "0m"; `seconds` adds "12s" under an hour. */
export function formatDuration(ms: number, opts: { seconds?: boolean } = {}): string {
  const totalMin = Math.floor(Math.max(0, ms) / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0 && opts.seconds) {
    const s = Math.floor((Math.max(0, ms) % 60_000) / 1000);
    return m === 0 ? `${s}s` : `${m}m ${s}s`;
  }
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Decimal hours for chart axes: 15.5. */
export function hours(ms: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round((ms / 3_600_000) * f) / f;
}

/** Accessible duration: "15 hours 30 minutes". */
export function spokenDuration(ms: number): string {
  const totalMin = Math.floor(Math.max(0, ms) / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const parts = [];
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m || !h) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  return parts.join(" ");
}

export function formatTime(instant: number, timeZone: string, clock: ClockFormat = "24h"): string {
  const w = wallClock(instant, timeZone);
  if (clock === "24h") return `${pad(w.hour)}:${pad(w.minute)}`;
  const h = w.hour % 12 === 0 ? 12 : w.hour % 12;
  return `${h}:${pad(w.minute)} ${w.hour < 12 ? "am" : "pm"}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekday(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** "Mon 26 Oct" (adds the year when it isn't `thisYear`). */
export function formatDate(date: LocalDate, opts: { long?: boolean; thisYear?: string; weekday?: boolean } = {}): string {
  const { year, month, day } = parseLocalDate(date);
  const wd = opts.weekday === false ? "" : `${(opts.long ? DAYS_LONG : DAYS)[weekday(date)]} `;
  const y = opts.thisYear && opts.thisYear !== String(year) ? ` ${year}` : "";
  return `${wd}${day} ${(opts.long ? MONTHS_LONG : MONTHS)[month - 1]}${y}`;
}

export function formatMonth(key: string, long = true): string {
  const [y, m] = key.split("-").map(Number);
  return `${(long ? MONTHS_LONG : MONTHS)[m - 1]} ${y}`;
}

export function weekdayShort(date: LocalDate): string {
  return DAYS[weekday(date)];
}

/** "Today", "Yesterday", or the date. */
export function relativeDay(date: LocalDate, today: LocalDate, thisYear = today.slice(0, 4)): string {
  if (date === today) return "Today";
  const t = parseLocalDate(today);
  const yesterday = new Date(Date.UTC(t.year, t.month - 1, t.day - 1)).toISOString().slice(0, 10);
  if (date === yesterday) return "Yesterday";
  return formatDate(date, { thisYear });
}

/** Short zone label for an instant: "EAT", "GMT+3", "BST". */
export function zoneAbbreviation(instant: number, timeZone: string): string {
  try {
    const part = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" }).formatToParts(new Date(instant)).find((p) => p.type === "timeZoneName");
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

/** "Mon 26 Oct, 18:00" in the session's zone. */
export function formatInstant(instant: number, timeZone: string, clock: ClockFormat = "24h", thisYear?: string): string {
  return `${formatDate(localDateOf(instant, timeZone), { thisYear })}, ${formatTime(instant, timeZone, clock)}`;
}

/** A friendly default title from the start hour and place: "Night shift at Office". */
export function smartTitle(startHour: number, place?: string | null): string {
  const part =
    startHour >= 5 && startHour < 11 ? "Morning shift" : startHour >= 11 && startHour < 16 ? "Day shift" : startHour >= 16 && startHour < 21 ? "Evening shift" : "Night shift";
  return place ? `${part} at ${place}` : part;
}
