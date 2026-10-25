/**
 * Mochi's part lists and palettes as plain data. The renderers (mochi.tsx, habitat.tsx) key their drawing
 * maps by these unions, so TypeScript fails if a part has no drawing; tests/mochi-catalog.test.ts fails if a
 * part has no catalog entry (or the reverse).
 */

export const MOODS = ["happy", "focused", "sleepy", "resting", "celebrating", "proud", "curious"] as const;
export type MochiMood = (typeof MOODS)[number];

export const PALETTE_KEYS = ["lilac", "peach", "mint", "sky", "sunflower", "rose", "cocoa", "midnight"] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];

/** "none" is always available and is not a catalog item. */
export const HAT_KEYS = [
  "beanie",
  "party-hat",
  "flower-crown",
  "night-cap",
  "wizard",
  "headphones",
  "chef",
  "crown",
] as const;
export type HatKey = (typeof HAT_KEYS)[number];

export const ACCESSORY_KEYS = ["scarf", "glasses", "bowtie", "backpack", "star-wand"] as const;
export type AccessoryKey = (typeof ACCESSORY_KEYS)[number];

export const BACKGROUND_KEYS = ["dusk", "dawn", "starfield", "meadow", "rainy-window", "library"] as const;
export type BackgroundKey = (typeof BACKGROUND_KEYS)[number];

export const DECOR_KEYS = [
  "plant",
  "lamp",
  "bookshelf",
  "rug",
  "string-lights",
  "window-moon",
  "cushion",
  "clock",
  "treasure-chest",
  "trophy-shelf",
  "coffee-mug",
  "record-player",
] as const;
export type DecorKey = (typeof DECOR_KEYS)[number];

/** Wall-mounted decor; outdoor backgrounds (starfield, meadow) have no wall, so these are not drawn there. */
export const WALL_DECOR: readonly DecorKey[] = ["bookshelf", "window-moon", "clock", "trophy-shelf"];
export const OUTDOOR_BACKGROUNDS: readonly BackgroundKey[] = ["starfield", "meadow"];

export type MochiPalette = {
  /** Main body fill (lit side). */
  body: string;
  /** Lighter tone for the top-left of the body gradient. */
  light: string;
  /** Darker tone for the bottom-right of the body gradient. */
  shade: string;
  /** Soft outline. */
  outline: string;
  cheek: string;
  eye: string;
  /** Inside of an open mouth. */
  mouth: string;
  /** Optional tiny freckles (midnight has star specks). */
  speck?: string;
};

export const PALETTES: Record<PaletteKey, MochiPalette> = {
  lilac: { body: "#c4b2ff", light: "#e9e1ff", shade: "#9a83f2", outline: "#6650c8", cheek: "#ff9cc4", eye: "#2b2147", mouth: "#4a2a55" },
  peach: { body: "#ffc2a1", light: "#ffe6d6", shade: "#f2966f", outline: "#b85f3c", cheek: "#ff7f92", eye: "#3b2320", mouth: "#5a2a2a" },
  mint: { body: "#a9ecd0", light: "#e0fbef", shade: "#6ccaa2", outline: "#368a68", cheek: "#ff9db3", eye: "#1d3a30", mouth: "#3b2a33" },
  sky: { body: "#b2d6ff", light: "#e3f1ff", shade: "#78aaef", outline: "#3c69b0", cheek: "#ff9fc2", eye: "#1b2945", mouth: "#3a2440" },
  sunflower: { body: "#ffdc6e", light: "#fff3c2", shade: "#f2b23a", outline: "#b07512", cheek: "#ff8f6b", eye: "#3a2a10", mouth: "#5a2a1a" },
  rose: { body: "#ffb3cb", light: "#ffe0ea", shade: "#ef80a4", outline: "#b0466f", cheek: "#ff6f93", eye: "#3b1c2a", mouth: "#5a1f36" },
  cocoa: { body: "#d8b096", light: "#f3e1d3", shade: "#b08164", outline: "#6e4a34", cheek: "#ff9a8a", eye: "#2a170f", mouth: "#3f1d14" },
  midnight: {
    body: "#6a6fd6",
    light: "#a3a8f2",
    shade: "#4146a6",
    outline: "#24276a",
    cheek: "#ff92c8",
    eye: "#100e2c",
    mouth: "#1c1640",
    speck: "#fff3c4",
  },
};
