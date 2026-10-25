/**
 * Everything Mochi can unlock, as data. Pure: no React, no storage. The rewards engine decides the level and
 * which achievements are earned; this file only answers "what does that unlock".
 *
 * Unlocks come from levels (XP is capped and never proportional to long hours) or from achievements.
 * "none" hats/accessories are always available and are not items.
 */
import {
  ACCESSORY_KEYS,
  BACKGROUND_KEYS,
  DECOR_KEYS,
  HAT_KEYS,
  PALETTE_KEYS,
  type AccessoryKey,
  type BackgroundKey,
  type DecorKey,
  type HatKey,
  type PaletteKey,
} from "./parts";

export const ACHIEVEMENT_CODES = [
  "first_clock_in",
  "night_owl",
  "consistency_week",
  "break_champion",
  "data_keeper",
  "first_100h",
  "comeback",
  "early_bird",
  "weekly_reviewer",
  "rest_respecter",
] as const;
export type AchievementCode = (typeof ACHIEVEMENT_CODES)[number];

export type CatalogKind = "palette" | "hat" | "accessory" | "background" | "decor";
export type CatalogKey = PaletteKey | HatKey | AccessoryKey | BackgroundKey | DecorKey;
export type Unlock = { level: number } | { achievement: AchievementCode } | { default: true };

export type CatalogItem = {
  key: CatalogKey;
  kind: CatalogKind;
  name: string;
  description: string;
  unlock: Unlock;
};

export const MAX_LEVEL = 30;

export const CATALOG: readonly CatalogItem[] = [
  // Starting set
  { key: "lilac", kind: "palette", name: "Lilac", description: "Mochi's own soft lilac.", unlock: { default: true } },
  { key: "dusk", kind: "background", name: "Dusk room", description: "A warm room as the sun goes down.", unlock: { default: true } },
  { key: "rug", kind: "decor", name: "Round rug", description: "Somewhere soft to stand.", unlock: { default: true } },

  // Levels: something new at every level up to 24, then every couple of levels.
  { key: "peach", kind: "palette", name: "Peach", description: "Sweet and warm.", unlock: { level: 2 } },
  { key: "beanie", kind: "hat", name: "Beanie", description: "A cosy knitted beanie with a pom.", unlock: { level: 3 } },
  { key: "plant", kind: "decor", name: "Leafy plant", description: "A little green friend.", unlock: { level: 4 } },
  { key: "scarf", kind: "accessory", name: "Scarf", description: "Striped and snug.", unlock: { level: 5 } },
  { key: "mint", kind: "palette", name: "Mint", description: "Fresh as a deep breath.", unlock: { level: 6 } },
  { key: "lamp", kind: "decor", name: "Floor lamp", description: "A warm pool of light.", unlock: { level: 7 } },
  { key: "headphones", kind: "hat", name: "Headphones", description: "Music for the quiet hours.", unlock: { level: 8 } },
  { key: "starfield", kind: "background", name: "Starfield", description: "A hill under a sky full of stars.", unlock: { level: 9 } },
  { key: "sky", kind: "palette", name: "Sky", description: "Clear-day blue.", unlock: { level: 10 } },
  { key: "bowtie", kind: "accessory", name: "Bow tie", description: "Smart, but not too serious.", unlock: { level: 11 } },
  { key: "bookshelf", kind: "decor", name: "Bookshelf", description: "Stories for slow evenings.", unlock: { level: 12 } },
  { key: "string-lights", kind: "decor", name: "String lights", description: "Little warm bulbs overhead.", unlock: { level: 13 } },
  { key: "sunflower", kind: "palette", name: "Sunflower", description: "Bright and cheerful.", unlock: { level: 14 } },
  { key: "meadow", kind: "background", name: "Meadow", description: "Grass, flowers and a gentle breeze.", unlock: { level: 15 } },
  { key: "chef", kind: "hat", name: "Chef's hat", description: "For a proper lunch break.", unlock: { level: 16 } },
  { key: "window-moon", kind: "decor", name: "Moon window", description: "A small window with the moon in it.", unlock: { level: 17 } },
  { key: "rose", kind: "palette", name: "Rose", description: "Soft pink petals.", unlock: { level: 18 } },
  { key: "backpack", kind: "accessory", name: "Backpack", description: "Ready for the commute.", unlock: { level: 19 } },
  { key: "rainy-window", kind: "background", name: "Rainy window", description: "Rain on the glass, cosy inside.", unlock: { level: 20 } },
  { key: "clock", kind: "decor", name: "Wall clock", description: "Keeps gentle time.", unlock: { level: 21 } },
  { key: "wizard", kind: "hat", name: "Wizard hat", description: "Starry and a little bit magic.", unlock: { level: 22 } },
  { key: "cocoa", kind: "palette", name: "Cocoa", description: "Warm like a hot drink.", unlock: { level: 23 } },
  { key: "library", kind: "background", name: "Library", description: "Tall shelves and quiet.", unlock: { level: 24 } },
  { key: "midnight", kind: "palette", name: "Midnight", description: "Deep blue with star freckles.", unlock: { level: 26 } },
  { key: "record-player", kind: "decor", name: "Record player", description: "Slow songs for rest days.", unlock: { level: 28 } },
  { key: "crown", kind: "hat", name: "Crown", description: "For a long, steady journey together.", unlock: { level: 30 } },

  // Achievements
  { key: "party-hat", kind: "hat", name: "Party hat", description: "Your first clock-in. Hello!", unlock: { achievement: "first_clock_in" } },
  { key: "night-cap", kind: "hat", name: "Night cap", description: "For the night owls.", unlock: { achievement: "night_owl" } },
  { key: "flower-crown", kind: "hat", name: "Flower crown", description: "A week of steady days.", unlock: { achievement: "consistency_week" } },
  { key: "coffee-mug", kind: "decor", name: "Cosy mug", description: "You took your breaks.", unlock: { achievement: "break_champion" } },
  { key: "treasure-chest", kind: "decor", name: "Treasure chest", description: "Your data, safely kept.", unlock: { achievement: "data_keeper" } },
  { key: "trophy-shelf", kind: "decor", name: "Trophy shelf", description: "100 hours logged, all told.", unlock: { achievement: "first_100h" } },
  { key: "star-wand", kind: "accessory", name: "Star wand", description: "Welcome back. A little magic.", unlock: { achievement: "comeback" } },
  { key: "dawn", kind: "background", name: "Dawn room", description: "Morning light for early birds.", unlock: { achievement: "early_bird" } },
  { key: "glasses", kind: "accessory", name: "Reading glasses", description: "For looking back over the week.", unlock: { achievement: "weekly_reviewer" } },
  { key: "cushion", kind: "decor", name: "Big cushion", description: "Rest days count too.", unlock: { achievement: "rest_respecter" } },
];

const BY_KEY = new Map<string, CatalogItem>(CATALOG.map((item) => [item.key, item]));

/** Every part the renderers can draw, by kind (used by the tests to keep catalog and drawings in step). */
export const DRAWABLE_KEYS: Record<CatalogKind, readonly string[]> = {
  palette: PALETTE_KEYS,
  hat: HAT_KEYS,
  accessory: ACCESSORY_KEYS,
  background: BACKGROUND_KEYS,
  decor: DECOR_KEYS,
};

export function catalogItem(key: string): CatalogItem | undefined {
  return BY_KEY.get(key);
}

function unlockedBy(item: CatalogItem, level: number, codes: ReadonlySet<string>): boolean {
  const unlock = item.unlock;
  if ("default" in unlock) return true;
  if ("level" in unlock) return level >= unlock.level;
  return codes.has(unlock.achievement);
}

/** Keys of every item unlocked at `level` with the earned `achievementCodes`. */
export function unlockedKeys(level: number, achievementCodes: readonly string[]): Set<string> {
  const codes = new Set(achievementCodes);
  return new Set(CATALOG.filter((item) => unlockedBy(item, level, codes)).map((item) => item.key));
}

/** Whether one item is unlocked. Unknown keys are never unlocked; "none" (no hat, no accessory) always is. */
export function isUnlocked(key: string, level: number, achievementCodes: readonly string[]): boolean {
  if (key === "none") return true;
  const item = BY_KEY.get(key);
  return item ? unlockedBy(item, level, new Set(achievementCodes)) : false;
}

/** The next `n` level unlocks above `level`, nearest first (achievement items are not on the level road). */
export function nextUnlocks(level: number, n: number): CatalogItem[] {
  return CATALOG.filter((item) => "level" in item.unlock && item.unlock.level > level)
    .sort((a, b) => levelOf(a) - levelOf(b))
    .slice(0, Math.max(0, n));
}

function levelOf(item: CatalogItem): number {
  return "level" in item.unlock ? item.unlock.level : 0;
}
