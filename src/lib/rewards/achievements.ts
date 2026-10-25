/**
 * Achievements: one-time, sticky. Detection finds the earliest qualifying moment in the current history;
 * anything already in `earned` stays earned (with its original instant) even if later edits remove the
 * session that earned it. Copy is warm and never shaming.
 */
import type { Activity, EarnedAchievement } from "@/lib/shifts/profile";
import { startOfWeek, wallClock, type LocalDate, type WeekStart } from "@/lib/time/zone";

import { byStart, type SessionFacts } from "./rules";
import type { AchievementCode, AchievementDef, AchievementView, RewardTarget } from "./types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const CONSISTENCY_DAYS = 5;
export const BREAK_CHAMPION_SESSIONS = 10;
export const MILESTONE_NET_MS = 100 * HOUR;
export const COMEBACK_GAP_MS = 7 * DAY;
export const EARLY_BIRD_HOURS = [5, 6, 7] as const;
export const WEEKLY_REVIEWER_COUNT = 4;
export const REST_RESPECTER_COUNT = 8;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    code: "first_clock_in",
    name: "First Clock-In",
    description: "You tapped Clock in for the first time. Mochi is on the clock with you.",
    hint: "Start a session with the timer.",
    xp: 25,
  },
  {
    code: "night_owl",
    name: "Night Owl",
    description: "You finished a session that ran past midnight. The days split, your shift stayed whole.",
    hint: "Complete a session that crosses midnight.",
    xp: 30,
  },
  {
    code: "consistency_week",
    name: "Consistency Week",
    description: "You logged work on five different days in one week.",
    hint: "Log work on five different days in one week.",
    xp: 40,
  },
  {
    code: "break_champion",
    name: "Break Champion",
    description: "You took a proper break in ten sessions. Rest is part of the work.",
    hint: "Take a real break in ten sessions.",
    xp: 40,
  },
  {
    code: "data_keeper",
    name: "Data Keeper",
    description: "You exported your records. Your data, in your hands.",
    hint: "Export your data once.",
    xp: 25,
  },
  {
    code: "first_100h",
    name: "First 100h Logged",
    description: "100 hours of work logged in total. Every session counted, short or long.",
    hint: "Log 100 hours in total, across any number of sessions.",
    xp: 60,
  },
  {
    code: "comeback",
    name: "Comeback",
    description: "Welcome back! You picked things up again after some time away. Mochi is glad to see you.",
    hint: "Come back after a week or more away.",
    xp: 30,
  },
  {
    code: "early_bird",
    name: "Early Bird",
    description: "You started a session between 05:00 and 08:00.",
    hint: "Start a session between 05:00 and 08:00.",
    xp: 25,
  },
  {
    code: "weekly_reviewer",
    name: "Weekly Reviewer",
    description: "You reviewed four weeks. Looking back helps plan ahead.",
    hint: "Do the weekly review four times.",
    xp: 40,
  },
  {
    code: "rest_respecter",
    name: "Rest Respecter",
    description: "You kept eight planned rest days free. Recovery counts.",
    hint: "Keep eight planned rest days free of work.",
    xp: 40,
  },
];

const DEFS = new Map<string, AchievementDef>(ACHIEVEMENTS.map((a) => [a.code, a]));

export function achievementDef(code: string): AchievementDef | undefined {
  return DEFS.get(code);
}

export interface Detected {
  earnedAt: number;
  sourceSessionId: string | null;
}

const byEnd = (a: SessionFacts, b: SessionFacts) => (a.session.endedAt as number) - (b.session.endedAt as number) || a.session.id.localeCompare(b.session.id);
const byAt = (a: { at: number; key: string }, b: { at: number; key: string }) => a.at - b.at || a.key.localeCompare(b.key);
const fromSession = (f: SessionFacts, at: number): Detected => ({ earnedAt: at, sourceSessionId: f.session.id });
const ended = (f: SessionFacts) => f.session.endedAt as number;

function nth<T>(items: readonly T[], n: number): T | undefined {
  return items.length >= n ? items[n - 1] : undefined;
}

export interface DetectionInput {
  facts: readonly SessionFacts[];
  activities: readonly Activity[];
  weekStart: WeekStart;
  breakAwards: readonly RewardTarget[];
  restAwards: readonly RewardTarget[];
  reviewAwards: readonly RewardTarget[];
}

/** The earliest qualifying moment of each achievement in the current history. */
export function detectAchievements(input: DetectionInput): Map<AchievementCode, Detected> {
  const { facts, activities, weekStart } = input;
  const out = new Map<AchievementCode, Detected>();
  const counted = facts.filter((f) => f.counted).sort(byEnd);
  const completed = facts.filter((f) => f.completed).sort(byEnd);

  // Arriving moments are dated at the start: the celebration belongs to the clock-in.
  const firstTimer = facts.filter((f) => f.session.origin === "timer").map((f) => f.session).sort(byStart)[0];
  if (firstTimer) out.set("first_clock_in", { earnedAt: firstTimer.startedAt, sourceSessionId: firstTimer.id });

  const owl = counted.find((f) => f.dates.length >= 2);
  if (owl) out.set("night_owl", fromSession(owl, ended(owl)));

  const weeks = new Map<LocalDate, Set<LocalDate>>();
  for (const f of counted) {
    const week = startOfWeek(f.anchor, weekStart);
    const dates = weeks.get(week) ?? new Set<LocalDate>();
    dates.add(f.anchor);
    weeks.set(week, dates);
    if (dates.size >= CONSISTENCY_DAYS) {
      out.set("consistency_week", fromSession(f, ended(f)));
      break;
    }
  }

  const champion = nth([...input.breakAwards].sort(byAt), BREAK_CHAMPION_SESSIONS);
  if (champion) out.set("break_champion", { earnedAt: champion.at, sourceSessionId: champion.sourceSessionId });

  const exportActivity = activities
    .filter((a) => a.type === "export")
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))[0];
  if (exportActivity) out.set("data_keeper", { earnedAt: exportActivity.at, sourceSessionId: null });

  let total = 0;
  for (const f of completed) {
    total += f.netMs;
    if (total >= MILESTONE_NET_MS) {
      out.set("first_100h", fromSession(f, ended(f)));
      break;
    }
  }

  let lastEnd: number | null = null;
  for (const f of facts) {
    if (lastEnd !== null && f.session.startedAt - lastEnd >= COMEBACK_GAP_MS) {
      out.set("comeback", { earnedAt: f.session.startedAt, sourceSessionId: f.session.id });
      break;
    }
    const end = f.session.endedAt ?? f.session.startedAt;
    lastEnd = lastEnd === null ? end : Math.max(lastEnd, end);
  }

  const early = counted.find((f) => (EARLY_BIRD_HOURS as readonly number[]).includes(wallClock(f.session.startedAt, f.session.reportingTimeZone).hour));
  if (early) out.set("early_bird", fromSession(early, ended(early)));

  const reviewer = nth([...input.reviewAwards].sort(byAt), WEEKLY_REVIEWER_COUNT);
  if (reviewer) out.set("weekly_reviewer", { earnedAt: reviewer.at, sourceSessionId: null });

  const rester = nth([...input.restAwards].sort(byAt), REST_RESPECTER_COUNT);
  if (rester) out.set("rest_respecter", { earnedAt: rester.at, sourceSessionId: null });

  return out;
}

/**
 * Persisted achievements win (sticky, original instant); newly detected ones are added. Unknown codes in
 * `earned` (from a newer app version) are kept as-is by the caller but get no view here.
 */
export function mergeAchievements(earned: readonly EarnedAchievement[], detected: ReadonlyMap<AchievementCode, Detected>): AchievementView[] {
  const views: AchievementView[] = [];
  const seen = new Set<string>();
  for (const e of [...earned].sort((a, b) => a.earnedAt - b.earnedAt || a.code.localeCompare(b.code))) {
    const def = DEFS.get(e.code);
    if (!def || seen.has(e.code)) continue;
    seen.add(e.code);
    views.push({ ...def, earnedAt: e.earnedAt, sourceSessionId: e.sourceSessionId, isNew: false });
  }
  for (const def of ACHIEVEMENTS) {
    const d = detected.get(def.code);
    if (!d || seen.has(def.code)) continue;
    views.push({ ...def, earnedAt: d.earnedAt, sourceSessionId: d.sourceSessionId, isNew: true });
  }
  return views.sort((a, b) => a.earnedAt - b.earnedAt || a.code.localeCompare(b.code));
}

export function achievementTargets(views: readonly AchievementView[]): RewardTarget[] {
  return views.map((v) => ({ key: `achievement:${v.code}`, rule: "achievement", xp: v.xp, sourceSessionId: v.sourceSessionId, at: v.earnedAt }));
}
