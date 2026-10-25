"use client";

import { useMemo, useSyncExternalStore } from "react";

import { Mochi } from "@/components/mochi/mochi";
import { ACCESSORY_KEYS, HAT_KEYS, PALETTE_KEYS, type AccessoryKey, type HatKey, type MochiMood, type PaletteKey } from "@/components/mochi/parts";
import type { Companion } from "@/lib/shifts/profile";
import type { ShiftState } from "@/lib/shifts/types";
import type { ProfileState } from "@/lib/shifts/profile";
import { rewardsFor } from "@/lib/store/rewards";

const has = <T extends string>(list: readonly T[], v: string | null): v is T => v !== null && (list as readonly string[]).includes(v);

/** Mochi dressed the way the person set it up on the Companion screen. */
export function CompanionMochi({
  companion,
  mood,
  size,
  animate = true,
  className,
}: {
  companion: Companion;
  mood: MochiMood;
  size: number;
  animate?: boolean;
  className?: string;
}) {
  return (
    <Mochi
      mood={mood}
      size={size}
      animate={animate}
      className={className}
      palette={has<PaletteKey>(PALETTE_KEYS, companion.palette) ? companion.palette : "lilac"}
      hat={has<HatKey>(HAT_KEYS, companion.hat) ? companion.hat : "none"}
      accessory={has<AccessoryKey>(ACCESSORY_KEYS, companion.accessory) ? companion.accessory : "none"}
      title={`${companion.name}, feeling ${mood}`}
    />
  );
}

/** Rewards for the whole history, recomputed at most once a minute (and on every data change). */
export function useRewards(state: ShiftState, profile: ProfileState, now: number) {
  const minute = Math.floor(now / 60_000) * 60_000;
  return useMemo(() => rewardsFor(state, profile, minute), [state, profile, minute]);
}

/** Short haptic tap when the person allowed it; silently nothing where unsupported. */
export function tapHaptic(enabled: boolean) {
  if (!enabled || typeof navigator === "undefined") return;
  try {
    navigator.vibrate?.(15);
  } catch {
    // some browsers throw when vibration is blocked by policy
  }
}

const noopSubscribe = () => () => {};

/**
 * False while React hydrates server HTML, true after. `useShift()` hands hydration the live client
 * snapshot (which may already be `ready`), so screens gate on `view.ready && hydrated` to render the
 * same skeleton the server sent, then swap in the real view.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
