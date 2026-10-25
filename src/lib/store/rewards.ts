/** Connects the pure rewards engine to the store: after every change, reconcile the append-only ledger. */
import { computeRewards, reconcileLedger, type RewardsResult } from "@/lib/rewards";
import type { ProfileState } from "@/lib/shifts/profile";
import type { ShiftState } from "@/lib/shifts/types";
import { localDateOf } from "@/lib/time/zone";

import type { StoreDeps, StoreView } from "./store";

export function rewardsFor(state: ShiftState, profile: ProfileState, now: number): RewardsResult {
  return computeRewards({
    sessions: Object.values(state.sessions),
    activities: profile.activities,
    settings: profile.settings,
    today: localDateOf(now, profile.settings.reportingTimeZone),
    now,
    earned: profile.achievements,
    highestLevel: profile.companion.highestLevel,
  });
}

export const deriveRewards: NonNullable<StoreDeps["derive"]> = (view: StoreView, now: number) => {
  if (!view.ready) return null;
  const result = rewardsFor(view.state, view.profile, now);
  const known = new Set(view.profile.achievements.map((a) => a.code));
  return {
    ledger: reconcileLedger(view.profile.ledger, result.targets),
    achievements: result.newAchievements.filter((a) => !known.has(a.code)).map((a) => ({ code: a.code, earnedAt: a.earnedAt, sourceSessionId: a.sourceSessionId })),
    highestLevel: result.level,
  };
};
