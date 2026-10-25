/**
 * Per-user state that isn't a session: settings, projects, remembered places, companion and reward ledger.
 * Lives on the device (IndexedDB) and, when signed in, in Supabase (last write wins per document — none of
 * it is time accounting). Sessions never live here.
 */
import "@/lib/zod-setup";
import { z } from "zod";

import { isValidTimeZone } from "@/lib/time/zone";

import { DEFAULT_GOAL_SECONDS } from "./reducer";

export const REMINDER_HOURS = [12, 14, 16, 18] as const;

export const settingsSchema = z.object({
  /** Applies to new sessions; each session keeps the zone it started with. */
  reportingTimeZone: z.string().refine(isValidTimeZone, "Unknown timezone"),
  defaultGoalSeconds: z.number().int().min(60).max(48 * 3600),
  weekStart: z.union([z.literal(0), z.literal(1)]),
  clock: z.enum(["24h", "12h"]),
  theme: z.enum(["system", "light", "dark"]),
  accent: z.enum(["lilac", "indigo", "teal", "peach"]),
  /** Ask for a point-in-time location at clock-in/out. Off = never asked. */
  locationOnClockIn: z.boolean(),
  locationOnClockOut: z.boolean(),
  /** Supportive rest prompts at these net hours (in-app; notifications only if permitted). */
  reminderHours: z.array(z.number().int().min(1).max(48)).max(8),
  breakNudgeMinutes: z.number().int().min(0).max(600),
  notifications: z.boolean(),
  /** Opt-in safety limit: clock out automatically at this many net hours. Null = never. */
  safetyLimitHours: z.number().int().min(1).max(48).nullable(),
  payTracking: z.boolean(),
  defaultPayRateMinor: z.number().int().min(0).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  /** Planned workdays for the forgiving rhythm (0 = Sunday). Unplanned days are rest days. */
  plannedWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
  /** Days to keep precise location fixes; null = until deleted. */
  locationRetentionDays: z.number().int().min(1).max(3650).nullable(),
  reducedMotion: z.enum(["system", "reduce", "full"]),
  haptics: z.boolean(),
  displayName: z.string().max(60),
  updatedAt: z.number().int(),
});
export type Settings = z.infer<typeof settingsSchema>;

export function defaultSettings(reportingTimeZone: string, now = 0): Settings {
  return {
    reportingTimeZone,
    defaultGoalSeconds: DEFAULT_GOAL_SECONDS,
    weekStart: 1,
    clock: "24h",
    theme: "system",
    accent: "lilac",
    locationOnClockIn: true,
    locationOnClockOut: false,
    reminderHours: [12, 14, 16],
    breakNudgeMinutes: 240,
    notifications: false,
    safetyLimitHours: null,
    payTracking: false,
    defaultPayRateMinor: null,
    currency: "TZS",
    plannedWeekdays: [1, 2, 3, 4, 5, 6],
    locationRetentionDays: 90,
    reducedMotion: "system",
    haptics: true,
    displayName: "",
    updatedAt: now,
  };
}

export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(60),
  color: z.enum(["lilac", "indigo", "teal", "sage", "peach", "rose", "sky", "sand"]),
  archived: z.boolean(),
  updatedAt: z.number().int(),
});
export type Project = z.infer<typeof projectSchema>;

export const placeSchema = z.object({
  id: z.uuid(),
  label: z.string().trim().min(1).max(40),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusM: z.number().int().min(25).max(5000),
  updatedAt: z.number().int(),
});
export type Place = z.infer<typeof placeSchema>;

/** Things the person did that rewards recognise (not sessions): weekly reviews, exports. */
export const activitySchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(["week_review", "export", "streak_freeze_used"]),
  /** Week key (YYYY-MM-DD of the week start) for reviews; date for freezes. */
  key: z.string().max(40),
  at: z.number().int(),
});
export type Activity = z.infer<typeof activitySchema>;

export const companionSchema = z.object({
  name: z.string().trim().min(1).max(24),
  palette: z.string().max(40),
  hat: z.string().max(40).nullable(),
  accessory: z.string().max(40).nullable(),
  background: z.string().max(40),
  decor: z.array(z.string().max(40)).max(12),
  /** Highest level ever reached: levels and unlocked items never go down. */
  highestLevel: z.number().int().min(1),
  unlocked: z.array(z.string().max(40)).max(200),
  updatedAt: z.number().int(),
});
export type Companion = z.infer<typeof companionSchema>;

export function defaultCompanion(now = 0): Companion {
  return { name: "Mochi", palette: "lilac", hat: null, accessory: null, background: "dusk", decor: ["plant"], highestLevel: 1, unlocked: [], updatedAt: now };
}

/** Append-only reward ledger row; `key` is unique per user (replays can't farm XP). */
export const ledgerEntrySchema = z.object({
  key: z.string().min(1).max(160),
  rule: z.string().max(40),
  xp: z.number().int().min(-1000).max(1000),
  sourceSessionId: z.uuid().nullable(),
  at: z.number().int(),
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

export const achievementSchema = z.object({
  code: z.string().max(40),
  earnedAt: z.number().int(),
  sourceSessionId: z.uuid().nullable(),
});
export type EarnedAchievement = z.infer<typeof achievementSchema>;

/** Everything except sessions, as one document for sync and export. */
export interface ProfileState {
  settings: Settings;
  projects: Project[];
  places: Place[];
  activities: Activity[];
  companion: Companion;
  ledger: LedgerEntry[];
  achievements: EarnedAchievement[];
}
