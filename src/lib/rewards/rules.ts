/**
 * The XP rules. Pure: every number comes from the session history, the activities, settings and `today`.
 * Nothing scales with hours: a session either crosses a threshold (30 min net, a real break) or it doesn't,
 * and a 20-hour shift is worth exactly what an 8-hour one is.
 */
import type { Activity, Settings } from "@/lib/shifts/profile";
import type { ShiftSession } from "@/lib/shifts/types";
import { allocateByDay, anchorDate, sessionMetrics } from "@/lib/time/allocate";
import { addDays, eachDate, isLocalDate, startOfLocalDay, startOfWeek, weekdayOf, type LocalDate } from "@/lib/time/zone";

import type { RewardTarget } from "./types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const XP = {
  complete: 20,
  live: 5,
  break: 10,
  day: 5,
  rest: 5,
  review: 15,
} as const;

/** A session counts (completion, day, rhythm) from 30 minutes net. */
export const MIN_COUNTED_NET_MS = 30 * MINUTE;
/** Completion awards per anchor date; the earliest sessions by start win. */
export const COMPLETIONS_PER_DAY = 2;
/** From this much net work, a healthy break is at least LONG_BREAK_MS; below it, SHORT_BREAK_MS. */
export const LONG_SESSION_NET_MS = 4 * HOUR;
export const LONG_BREAK_MS = 10 * MINUTE;
export const SHORT_BREAK_MS = 5 * MINUTE;
/** A rest day is rewarded only within this many days after a worked day, at most REST_AWARDS_PER_WEEK a week. */
export const REST_LOOKBACK_DAYS = 7;
export const REST_AWARDS_PER_WEEK = 2;

export interface SessionFacts {
  session: ShiftSession;
  anchor: LocalDate;
  netMs: number;
  completed: boolean;
  /** Completed with at least MIN_COUNTED_NET_MS net. */
  counted: boolean;
  /** Counted and within the daily completion cap. */
  awarded: boolean;
  healthyBreak: boolean;
  /** Local dates the session touches (elapsed > 0) in its reporting zone. */
  dates: LocalDate[];
}

export const byStart = (a: ShiftSession, b: ShiftSession) => a.startedAt - b.startedAt || a.id.localeCompare(b.id);

/** Facts for every non-deleted session, oldest start first. */
export function sessionFacts(sessions: readonly ShiftSession[], now: number): SessionFacts[] {
  const visible = sessions.filter((s) => s.deletedAt === null).sort(byStart);
  const perDate = new Map<LocalDate, number>();
  return visible.map((session) => {
    const metrics = sessionMetrics(session, now);
    const completed = session.endedAt !== null;
    const counted = completed && metrics.netMs >= MIN_COUNTED_NET_MS;
    const anchor = anchorDate(session);
    let awarded = false;
    if (counted) {
      const n = perDate.get(anchor) ?? 0;
      awarded = n < COMPLETIONS_PER_DAY;
      perDate.set(anchor, n + 1);
    }
    const minBreak = metrics.netMs >= LONG_SESSION_NET_MS ? LONG_BREAK_MS : SHORT_BREAK_MS;
    const healthyBreak = counted && metrics.breakIntervals.some((i) => i.end - i.start >= minBreak);
    const dates = allocateByDay(session, now, metrics).map((d) => d.date);
    return { session, anchor, netMs: metrics.netMs, completed, counted, awarded, healthyBreak, dates };
  });
}

/** Instant a session last changed (deletion or edit): where its reversals are dated. */
const changedAt = (s: ShiftSession) => s.deletedAt ?? s.updatedAt;

export interface BaseTargets {
  targets: RewardTarget[];
  breakAwards: RewardTarget[];
  restAwards: RewardTarget[];
  reviewAwards: RewardTarget[];
  /** Anchor dates of counted sessions. */
  workDates: Set<LocalDate>;
}

export function baseTargets(
  facts: readonly SessionFacts[],
  allSessions: readonly ShiftSession[],
  activities: readonly Activity[],
  settings: Settings,
  today: LocalDate,
): BaseTargets {
  const positive = new Map<string, RewardTarget>();
  const add = (t: RewardTarget) => positive.set(t.key, t);
  const breakAwards: RewardTarget[] = [];

  for (const f of facts) {
    if (!f.awarded) continue;
    const s = f.session;
    const at = s.endedAt as number;
    add({ key: `complete:${s.id}`, rule: "session_completed", xp: XP.complete, sourceSessionId: s.id, at });
    if (s.origin === "timer") add({ key: `live:${s.id}`, rule: "session_logged", xp: XP.live, sourceSessionId: s.id, at });
    if (f.healthyBreak) {
      const t: RewardTarget = { key: `break:${s.id}`, rule: "healthy_break", xp: XP.break, sourceSessionId: s.id, at };
      add(t);
      breakAwards.push(t);
    }
    // Facts are in start order, so the first awarded session of a date owns its day award.
    const dayKey = `day:${f.anchor}`;
    if (!positive.has(dayKey)) add({ key: dayKey, rule: "routine", xp: XP.day, sourceSessionId: s.id, at });
  }

  const workDates = new Set(facts.filter((f) => f.counted).map((f) => f.anchor));
  const restAwards = restTargets(facts, workDates, settings, today);
  for (const t of restAwards) add(t);
  const reviewAwards = reviewTargets(facts, activities, settings, today);
  for (const t of reviewAwards) add(t);

  // Tombstones: keys a session could hold but doesn't (any more), dated by its last change.
  const tombstones = new Map<string, RewardTarget>();
  for (const s of [...allSessions].sort(byStart)) {
    const at = changedAt(s);
    const keys: [string, RewardTarget["rule"]][] = [
      [`complete:${s.id}`, "session_completed"],
      [`live:${s.id}`, "session_logged"],
      [`break:${s.id}`, "healthy_break"],
      [`day:${anchorDate(s)}`, "routine"],
    ];
    for (const [key, rule] of keys) {
      if (positive.has(key)) continue;
      const prior = tombstones.get(key);
      if (!prior || at > prior.at) tombstones.set(key, { key, rule, xp: 0, sourceSessionId: s.id, at });
    }
  }

  const targets = [...positive.values(), ...tombstones.values()].sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
  return { targets, breakAwards, restAwards, reviewAwards, workDates };
}

/**
 * Planned rest days that were actually rest: unplanned weekday, strictly between the first session and
 * today, nobody clocked in on it, a worked day in the week before (so time away isn't paid as "rest"),
 * and at most two a week. Dated at the end of the rest day in the settings zone.
 */
function restTargets(facts: readonly SessionFacts[], workDates: ReadonlySet<LocalDate>, settings: Settings, today: LocalDate): RewardTarget[] {
  if (facts.length === 0) return [];
  const planned = new Set(settings.plannedWeekdays);
  const touched = new Set(facts.flatMap((f) => f.dates));
  const first = facts.reduce((min, f) => (f.anchor < min ? f.anchor : min), facts[0].anchor);
  const perWeek = new Map<LocalDate, number>();
  const out: RewardTarget[] = [];
  for (const date of eachDate(addDays(first, 1), addDays(today, -1))) {
    if (planned.has(weekdayOf(date)) || touched.has(date)) continue;
    let recentWork = false;
    for (let back = 1; back <= REST_LOOKBACK_DAYS && !recentWork; back++) recentWork = workDates.has(addDays(date, -back));
    if (!recentWork) continue;
    const week = startOfWeek(date, settings.weekStart);
    const n = perWeek.get(week) ?? 0;
    if (n >= REST_AWARDS_PER_WEEK) continue;
    perWeek.set(week, n + 1);
    const at = startOfLocalDay(addDays(date, 1), settings.reportingTimeZone);
    out.push({ key: `rest:${date}`, rule: "routine", xp: XP.rest, sourceSessionId: null, at });
  }
  return out;
}

/** One review per week (keys normalised to the week start), only for weeks from the first session up to today. */
function reviewTargets(facts: readonly SessionFacts[], activities: readonly Activity[], settings: Settings, today: LocalDate): RewardTarget[] {
  if (facts.length === 0) return [];
  const firstWeek = startOfWeek(facts.reduce((min, f) => (f.anchor < min ? f.anchor : min), facts[0].anchor), settings.weekStart);
  const byWeek = new Map<LocalDate, number>();
  for (const a of activities) {
    if (a.type !== "week_review" || !isLocalDate(a.key) || a.key > today) continue;
    const week = startOfWeek(a.key, settings.weekStart);
    if (week < firstWeek) continue;
    const prior = byWeek.get(week);
    if (prior === undefined || a.at < prior) byWeek.set(week, a.at);
  }
  return [...byWeek.entries()]
    .map(([week, at]): RewardTarget => ({ key: `review:${week}`, rule: "weekly_review", xp: XP.review, sourceSessionId: null, at }))
    .sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
}
