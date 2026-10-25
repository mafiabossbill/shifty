/**
 * SHIFTY rewards engine: a pure function of the session history (A07). No clock, no randomness — the same
 * input gives the same targets, achievements, level and rhythm on every device. Persist with
 * `reconcileLedger(profile.ledger, result.targets)`, append `result.newAchievements` to `earned`, and set
 * `companion.highestLevel = result.level`.
 */
import { isLocalDate } from "@/lib/time/zone";

import { achievementTargets, detectAchievements, mergeAchievements } from "./achievements";
import { progressInLevel, levelForXp } from "./levels";
import { rhythm } from "./rhythm";
import { COMPLETIONS_PER_DAY, MIN_COUNTED_NET_MS, baseTargets, sessionFacts } from "./rules";
import type { RewardInput, RewardRule, RewardTarget, RewardsResult, SessionRewardLine, SessionRewardSummary } from "./types";

export * from "./types";
export { ACHIEVEMENTS, achievementDef } from "./achievements";
export { LEVEL_STEP_XP, levelForXp, progressInLevel, xpForLevel } from "./levels";
export { ledgerBalances, ledgerTotal, parseLedgerKey, reconcileLedger } from "./ledger";
export { DAYS_PER_FREEZE, MAX_FREEZES, rhythm } from "./rhythm";
export { COMPLETIONS_PER_DAY, MIN_COUNTED_NET_MS, XP } from "./rules";

const LABELS: Record<string, string> = {
  complete: "Session completed",
  live: "Logged live with the timer",
  break: "Took a healthy break",
  day: "Showed up today",
};

function lineLabel(t: RewardTarget, achievementName: (code: string) => string | undefined): string {
  const prefix = t.key.slice(0, t.key.indexOf(":"));
  if (prefix === "achievement") return achievementName(t.key.slice("achievement:".length)) ?? "Achievement";
  return LABELS[prefix] ?? t.rule;
}

export function computeRewards(input: RewardInput): RewardsResult {
  const { settings, today } = input;
  const facts = sessionFacts(input.sessions, input.now);
  const base = baseTargets(facts, input.sessions, input.activities, settings, today);
  const detected = detectAchievements({
    facts,
    activities: input.activities,
    weekStart: settings.weekStart,
    breakAwards: base.breakAwards,
    restAwards: base.restAwards,
    reviewAwards: base.reviewAwards,
  });
  const achievements = mergeAchievements(input.earned, detected);
  const targets = [...base.targets, ...achievementTargets(achievements)].sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
  const totalXp = targets.reduce((sum, t) => sum + t.xp, 0);
  const progress = progressInLevel(totalXp, input.highestLevel ?? 1);

  const xpBySession: Record<string, number> = {};
  for (const t of targets) {
    if (t.sourceSessionId === null || t.xp === 0) continue;
    xpBySession[t.sourceSessionId] = (xpBySession[t.sourceSessionId] ?? 0) + t.xp;
  }

  // A running session (even one that began yesterday) keeps its anchor date "logged" for the rhythm.
  const workDates = new Set(base.workDates);
  for (const f of facts) if (!f.completed) workDates.add(f.anchor);
  const freezesUsed = input.activities.filter((a) => a.type === "streak_freeze_used" && isLocalDate(a.key)).map((a) => a.key);

  const names = new Map(achievements.map((a) => [a.code as string, a.name]));
  const factsById = new Map(facts.map((f) => [f.session.id, f]));

  function summaryForSession(sessionId: string): SessionRewardSummary {
    const lines: SessionRewardLine[] = targets
      .filter((t) => t.sourceSessionId === sessionId && t.xp > 0)
      .map((t) => ({ key: t.key, rule: t.rule as RewardRule, xp: t.xp, label: lineLabel(t, (c) => names.get(c)) }));
    const notes: string[] = [];
    const f = factsById.get(sessionId);
    if (f?.completed && !f.counted) {
      notes.push(`Sessions earn XP from ${MIN_COUNTED_NET_MS / 60_000} minutes of net work.`);
    } else if (f?.counted && !f.awarded) {
      notes.push(`Completion XP counts for ${COMPLETIONS_PER_DAY} sessions a day. This one still counts for your day and your records.`);
    }
    return {
      sessionId,
      xp: lines.reduce((sum, l) => sum + l.xp, 0),
      lines,
      achievements: achievements.filter((a) => a.sourceSessionId === sessionId),
      notes,
    };
  }

  return {
    targets,
    totalXp,
    xpLevel: levelForXp(totalXp),
    level: progress.level,
    progress,
    achievements,
    newAchievements: achievements.filter((a) => a.isNew),
    rhythm: rhythm({ workDates, plannedWeekdays: settings.plannedWeekdays, today, freezesUsed }),
    xpBySession,
    summaryForSession,
  };
}
