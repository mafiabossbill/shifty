"use client";

import * as React from "react";

import { unlockedKeys } from "@/components/mochi/catalog";
import { moodFor, type MochiStatus } from "@/components/mochi/mood";
import { ACHIEVEMENTS } from "@/lib/rewards";
import { equippedLook } from "@/lib/settings/companion";
import { rewardsFor } from "@/lib/store/rewards";
import { useNow, useShift } from "@/lib/store/react";
import { sessionMetrics } from "@/lib/time/allocate";
import { localDateOf, wallClock } from "@/lib/time/zone";

const JUST_FINISHED_MS = 30 * 60_000;
const NAMES = new Map<string, string>(ACHIEVEMENTS.map((a) => [a.code, a.name]));
export const achievementName = (code: string) => NAMES.get(code);

/** Everything the Companion screen derives from the store, recomputed once a minute or on change. */
export function useCompanion() {
  const view = useShift();
  const now = useNow(60_000);
  const rewards = React.useMemo(() => (view.ready ? rewardsFor(view.state, view.profile, now) : null), [view.ready, view.state, view.profile, now]);
  const settings = view.profile.settings;
  const companion = view.profile.companion;
  const level = Math.max(rewards?.level ?? 1, companion.highestLevel);
  const earnedCodes = React.useMemo(() => rewards?.achievements.map((a) => a.code as string) ?? view.profile.achievements.map((a) => a.code), [rewards, view.profile.achievements]);
  const unlocked = React.useMemo(() => {
    const set = unlockedKeys(level, earnedCodes);
    for (const key of companion.unlocked) set.add(key);
    return set;
  }, [level, earnedCodes, companion.unlocked]);
  const look = React.useMemo(() => equippedLook(companion, unlocked), [companion, unlocked]);

  const zone = settings.reportingTimeZone;
  const localHour = wallClock(now, zone).hour;
  const today = localDateOf(now, zone);
  const active = view.active;
  const last = view.sessions.find((s) => s.endedAt !== null) ?? null;
  let status: MochiStatus = "idle";
  let netMs = 0;
  let goalMs = 0;
  if (active) {
    status = active.breaks.some((b) => b.endedAt === null) ? "on_break" : "active";
    netMs = sessionMetrics(active, now).netMs;
    goalMs = active.goalSeconds * 1000;
  } else if (last && last.endedAt !== null && now - last.endedAt < JUST_FINISHED_MS) {
    status = "just_finished";
    netMs = sessionMetrics(last, now).netMs;
    goalMs = last.goalSeconds * 1000;
  }
  const moodWith = (recentlyCelebrated: boolean) => moodFor({ status, localHour, netMs, goalMs, recentlyCelebrated });

  return { view, now, rewards, settings, companion, level, earnedCodes, unlocked, look, zone, localHour, today, moodWith };
}
