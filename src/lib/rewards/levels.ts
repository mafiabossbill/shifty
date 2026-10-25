/**
 * Gentle quadratic curve: reaching level n takes 25·n·(n−1) XP in total (level n → n+1 spans 50·n XP).
 * A regular week (~5 sessions with breaks, rest days, a review) is ~225 XP, so level 5 (500 XP) arrives in
 * about two weeks and level 10 (2 250 XP) in about two months. Levels never go down.
 */
import type { LevelProgress } from "./types";

export const LEVEL_STEP_XP = 50;

/** Total XP needed to reach `level` (level 1 = 0). */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return (LEVEL_STEP_XP * n * (n - 1)) / 2;
}

export function levelForXp(xp: number): number {
  if (!(xp > 0)) return 1;
  let n = Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * xp) / LEVEL_STEP_XP)) / 2));
  while (xpForLevel(n + 1) <= xp) n++;
  while (n > 1 && xpForLevel(n) > xp) n--;
  return n;
}

/** Progress for the displayed level; when the highest level reached is above the XP level, progress starts at 0 there. */
export function progressInLevel(xp: number, highestLevel = 1): LevelProgress {
  const total = Math.max(0, xp);
  const level = Math.max(levelForXp(total), Math.max(1, Math.floor(highestLevel)));
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const levelSpan = next - floor;
  const xpIntoLevel = Math.max(0, total - floor);
  return { level, xpIntoLevel, levelSpan, xpToNext: Math.max(0, next - total), ratio: Math.min(1, xpIntoLevel / levelSpan) };
}
