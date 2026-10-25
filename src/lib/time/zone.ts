/**
 * Timezone-safe calendar arithmetic on absolute instants (epoch milliseconds), built on Intl only.
 * Rules: instants are the truth; a local date is derived for a named IANA zone; day boundaries are found
 * by searching the zone's real wall clock, never by adding 24 hours (DST days are 23 or 25 hours, and some
 * zones skip or repeat midnight itself).
 */

/** Calendar date in some zone, `YYYY-MM-DD`. Lexicographic order = chronological order. */
export type LocalDate = string;

export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || timeZone.length === 0 || timeZone.length > 64) return false;
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The zone this device is set to (falls back to UTC when the runtime can't say). */
export function deviceTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(zone) ? zone : "UTC";
  } catch {
    return "UTC";
  }
}

export function wallClock(instant: number, timeZone: string): WallClock {
  const parts = formatter(timeZone).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const hour = get("hour");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: hour === 24 ? 0 : hour,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Zone offset at an instant, in ms (local wall clock minus UTC). */
export function offsetMs(instant: number, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const wholeSecond = Math.floor(instant / 1000) * 1000;
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - wholeSecond;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export function toLocalDate(year: number, month: number, day: number): LocalDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function parseLocalDate(date: LocalDate): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Not a local date: ${date}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { year, month, day } = parseLocalDate(value);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export function localDateOf(instant: number, timeZone: string): LocalDate {
  const w = wallClock(instant, timeZone);
  return toLocalDate(w.year, w.month, w.day);
}

/** Pure calendar arithmetic (no zone involved). */
export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return toLocalDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export type WeekStart = 0 | 1;

export function startOfWeek(date: LocalDate, weekStart: WeekStart): LocalDate {
  return addDays(date, -((weekdayOf(date) - weekStart + 7) % 7));
}

export function monthKey(date: LocalDate): string {
  return date.slice(0, 7);
}

export function yearKey(date: LocalDate): string {
  return date.slice(0, 4);
}

export function startOfMonth(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(date: LocalDate, months: number): LocalDate {
  const { year, month } = parseLocalDate(date);
  const d = new Date(Date.UTC(year, month - 1 + months, 1));
  return toLocalDate(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

export function daysInMonth(date: LocalDate): number {
  const { year, month } = parseLocalDate(date);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Every date from `from` to `to`, inclusive. Empty when `to` < `from`. */
export function eachDate(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const dayStarts = new Map<string, number>();
const SEARCH_WINDOW_S = 16 * 3600; // offsets live within -12h…+14h

/**
 * First instant whose local date (in `timeZone`) is `date` or later. Usually local 00:00; on a day whose
 * midnight is skipped by a DST jump it is the first wall-clock time that exists. Binary search over whole
 * seconds (zone offsets are whole seconds), cached per zone and date.
 */
export function startOfLocalDay(date: LocalDate, timeZone: string): number {
  const key = `${timeZone}|${date}`;
  const cached = dayStarts.get(key);
  if (cached !== undefined) return cached;
  const { year, month, day } = parseLocalDate(date);
  const nominal = Date.UTC(year, month - 1, day) / 1000;
  let lo = nominal - SEARCH_WINDOW_S; // local date here is always before `date`
  let hi = nominal + SEARCH_WINDOW_S; // and always `date` or later here
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDateOf(mid * 1000, timeZone) >= date) hi = mid;
    else lo = mid;
  }
  const result = hi * 1000;
  if (dayStarts.size > 20_000) dayStarts.clear();
  dayStarts.set(key, result);
  return result;
}

/**
 * The next instant after `instant` where the local date changes. Always > `instant`, so a loop that
 * advances a cursor with it terminates.
 */
export function nextDayBoundary(instant: number, timeZone: string): number {
  const today = localDateOf(instant, timeZone);
  const candidate = startOfLocalDay(addDays(today, 1), timeZone);
  if (candidate > instant) return candidate;
  // A zone that falls back across midnight shows `today` again after tomorrow began: search forward.
  let lo = Math.floor(instant / 1000);
  let hi = lo + 2 * SEARCH_WINDOW_S;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDateOf(mid * 1000, timeZone) !== today) hi = mid;
    else lo = mid;
  }
  return Math.max(hi * 1000, instant + 1);
}

/** The instant for a wall-clock time in a zone. Ambiguous (repeated) times take the earlier instant;
 * skipped times (inside a DST gap) move forward by the gap, like a wall clock would. */
export function instantFromWallClock(
  wall: { year: number; month: number; day: number; hour: number; minute: number; second?: number },
  timeZone: string,
): number {
  const nominal = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second ?? 0);
  const candidates = new Set<number>();
  for (const probe of [nominal - 86_400_000, nominal, nominal + 86_400_000]) {
    candidates.add(nominal - offsetMs(probe, timeZone));
  }
  const exact = [...candidates]
    .filter((t) => {
      const w = wallClock(t, timeZone);
      return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) === nominal;
    })
    .sort((a, b) => a - b);
  if (exact.length > 0) return exact[0];
  // In a gap: use the offset in force before the jump.
  return nominal - offsetMs(nominal - 86_400_000 / 2, timeZone);
}

/** `YYYY-MM-DDTHH:mm` for a zone — the value of an <input type="datetime-local">. */
export function toWallClockInput(instant: number, timeZone: string): string {
  const w = wallClock(instant, timeZone);
  return `${toLocalDate(w.year, w.month, w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

export function fromWallClockInput(value: string, timeZone: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  if (!isLocalDate(`${y}-${mo}-${d}`) || Number(h) > 23 || Number(mi) > 59) return null;
  return instantFromWallClock(
    { year: Number(y), month: Number(mo), day: Number(d), hour: Number(h), minute: Number(mi), second: s ? Number(s) : 0 },
    timeZone,
  );
}
