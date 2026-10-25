/** Shared shapes of the rewards engine. Everything here is plain data: safe to persist, sync and compare. */
import type { Activity, EarnedAchievement, Settings } from "@/lib/shifts/profile";
import type { ShiftSession } from "@/lib/shifts/types";
import type { LocalDate } from "@/lib/time/zone";

/** What a target rewards. Values match the `reward_ledger_entries.kind` enum in the blueprint. */
export type RewardRule = "session_completed" | "session_logged" | "healthy_break" | "routine" | "weekly_review" | "achievement";

/** A ledger row's rule: the target's rule, or `reversal` for a row that takes XP back. */
export type LedgerRule = RewardRule | "reversal";

/**
 * The XP a key should be worth right now. `xp: 0` targets are tombstones: a key that used to qualify
 * (deleted or corrected session) — they give the reversal row a deterministic instant.
 */
export interface RewardTarget {
  /** Base key, e.g. `complete:<sessionId>`; ledger rows add `#<n>`. */
  key: string;
  rule: RewardRule;
  xp: number;
  sourceSessionId: string | null;
  /** Instant the reward is about (session end, activity, end of a rest day). Never the wall clock. */
  at: number;
}

export interface RewardInput {
  /** All sessions, including deleted ones (they are ignored for XP but give reversals their instant). */
  sessions: readonly ShiftSession[];
  activities: readonly Activity[];
  settings: Settings;
  /** Today in `settings.reportingTimeZone`. */
  today: LocalDate;
  /** Only used to measure a running session. */
  now: number;
  /** Achievements already persisted: sticky, they never go away. */
  earned: readonly EarnedAchievement[];
  /** `companion.highestLevel`: the displayed level never drops below it. */
  highestLevel?: number;
}

export type AchievementCode =
  | "first_clock_in"
  | "night_owl"
  | "consistency_week"
  | "break_champion"
  | "data_keeper"
  | "first_100h"
  | "comeback"
  | "early_bird"
  | "weekly_reviewer"
  | "rest_respecter";

export interface AchievementDef {
  code: AchievementCode;
  name: string;
  /** Shown once earned. */
  description: string;
  /** Shown while locked: how to earn it. */
  hint: string;
  xp: number;
}

export interface AchievementView extends AchievementDef {
  earnedAt: number;
  sourceSessionId: string | null;
  /** Not in `RewardInput.earned` yet: persist it and celebrate. */
  isNew: boolean;
}

export interface LevelProgress {
  /** Displayed level (never below the highest level reached). */
  level: number;
  /** XP earned inside this level. */
  xpIntoLevel: number;
  /** XP this level spans (from its threshold to the next one). */
  levelSpan: number;
  xpToNext: number;
  /** 0…1 */
  ratio: number;
}

export type TodayStatus = "logged" | "pending" | "rest";

export interface RhythmInput {
  workDates: ReadonlySet<LocalDate>;
  plannedWeekdays: readonly number[];
  today: LocalDate;
  /** Planned days a freeze already covered (Activity `streak_freeze_used`): honoured even if recomputed history has no freeze for them. */
  freezesUsed?: Iterable<LocalDate>;
}

export interface RhythmResult {
  current: number;
  best: number;
  freezesAvailable: number;
  todayStatus: TodayStatus;
  /** Every planned day a freeze covered, oldest first. Persist new ones as `streak_freeze_used` activities. */
  frozenDates: LocalDate[];
}

export interface SessionRewardLine {
  key: string;
  rule: RewardRule;
  xp: number;
  label: string;
}

export interface SessionRewardSummary {
  sessionId: string;
  xp: number;
  lines: SessionRewardLine[];
  achievements: AchievementView[];
  /** Plain sentences explaining XP the session did not get (cap, too short). Never scolding. */
  notes: string[];
}

export interface RewardsResult {
  /** Every target, including `xp: 0` tombstones. Pass to `reconcileLedger`. */
  targets: RewardTarget[];
  totalXp: number;
  /** Level from XP alone. */
  xpLevel: number;
  /** Displayed level = max(xpLevel, highestLevel). Persist as `companion.highestLevel`. */
  level: number;
  progress: LevelProgress;
  achievements: AchievementView[];
  newAchievements: AchievementView[];
  rhythm: RhythmResult;
  xpBySession: Record<string, number>;
  summaryForSession(sessionId: string): SessionRewardSummary;
}
