/**
 * Companion view models: what each catalog item looks like in a picker (equipped, unlocked, how to unlock),
 * the achievement list, and which newly earned achievements haven't been celebrated yet. Pure.
 */
import { CATALOG, type CatalogItem, type CatalogKind } from "@/components/mochi/catalog";
import type { HabitatTimeOfDay } from "@/components/mochi/habitat";
import type { AchievementDef } from "@/lib/rewards/types";
import type { Companion, EarnedAchievement } from "@/lib/shifts/profile";

export const MAX_DECOR = 6;

export function timeOfDayFor(hour: number): HabitatTimeOfDay {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 6 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

/** "Level 7" or "Earn Night Owl". Default items have no hint. */
export function unlockHint(item: CatalogItem, achievementName: (code: string) => string | undefined): string | null {
  const u = item.unlock;
  if ("default" in u) return null;
  if ("level" in u) return `Level ${u.level}`;
  return `Earn ${achievementName(u.achievement) ?? "an achievement"}`;
}

export interface ItemView {
  item: CatalogItem;
  unlocked: boolean;
  equipped: boolean;
  hint: string | null;
}

/** Items of one kind: unlocked first (catalog order), then locked by level, achievement items last. */
export function itemsOf(
  kind: CatalogKind,
  unlocked: ReadonlySet<string>,
  equipped: (key: string) => boolean,
  achievementName: (code: string) => string | undefined,
): ItemView[] {
  const rank = (i: CatalogItem) => ("default" in i.unlock ? 0 : "level" in i.unlock ? i.unlock.level : 1000);
  return CATALOG.filter((i) => i.kind === kind)
    .map((item) => ({ item, unlocked: unlocked.has(item.key), equipped: equipped(item.key), hint: unlockHint(item, achievementName) }))
    .sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || rank(a.item) - rank(b.item));
}

/** Equipped parts, falling back to the defaults when a key isn't unlocked (or is unknown) on this device. */
export function equippedLook(c: Companion, unlocked: ReadonlySet<string>) {
  const ok = (key: string | null) => (key !== null && unlocked.has(key) ? key : null);
  return {
    palette: ok(c.palette) ?? "lilac",
    hat: ok(c.hat) ?? "none",
    accessory: ok(c.accessory) ?? "none",
    background: ok(c.background) ?? "dusk",
    decor: c.decor.filter((d) => unlocked.has(d)).slice(0, MAX_DECOR),
  };
}

/** Adds or removes one decor item; refuses (returns null) when the room is full. */
export function toggleDecor(current: readonly string[], key: string): string[] | null {
  if (current.includes(key)) return current.filter((d) => d !== key);
  if (current.length >= MAX_DECOR) return null;
  return [...current, key];
}

export interface AchievementRow {
  code: string;
  name: string;
  description: string;
  hint: string;
  xp: number;
  earned: boolean;
  earnedAt: number | null;
  sourceSessionId: string | null;
  /** The catalog item this achievement unlocks, if any. */
  reward: CatalogItem | null;
}

/** All achievements in definition order; earned ones carry their date and source session. */
export function achievementRows(defs: readonly AchievementDef[], earned: readonly Pick<EarnedAchievement, "code" | "earnedAt" | "sourceSessionId">[]): AchievementRow[] {
  const byCode = new Map(earned.map((e) => [e.code, e]));
  return defs.map((d) => {
    const e = byCode.get(d.code);
    const reward = CATALOG.find((i) => "achievement" in i.unlock && i.unlock.achievement === d.code) ?? null;
    return {
      code: d.code,
      name: d.name,
      description: d.description,
      hint: d.hint,
      xp: d.xp,
      earned: Boolean(e),
      earnedAt: e?.earnedAt ?? null,
      sourceSessionId: e?.sourceSessionId ?? null,
      reward,
    };
  });
}

/** Earned codes not yet celebrated, newest first. */
export function unseenAchievements(earned: readonly Pick<EarnedAchievement, "code" | "earnedAt">[], seen: ReadonlySet<string>): string[] {
  return [...earned].filter((e) => !seen.has(e.code)).sort((a, b) => b.earnedAt - a.earnedAt).map((e) => e.code);
}

/** Parses the stored seen list defensively (anything odd = nothing seen). */
export function parseSeen(raw: string | null): Set<string> | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? new Set(value.filter((v): v is string => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}
