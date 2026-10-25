/** Zod schemas for every event that crosses a boundary (device → server, import files). */
import "@/lib/zod-setup";
import { z } from "zod";

import { isValidTimeZone } from "@/lib/time/zone";

import type { ShiftEvent } from "./types";

// 2000-01-01 … 2100-01-01: anything else is a broken clock or a forged payload.
const instant = z.number().int().min(946_684_800_000).max(4_102_444_800_000);
// Lower-cased so ids compare equal everywhere (the DB redacts by id).
const id = z.uuid().transform((v) => v.toLowerCase());
const zone = z.string().refine(isValidTimeZone, "Unknown timezone");
const text = (max: number) => z.string().max(max);

const base = {
  id,
  at: instant,
  recordedAt: instant,
  deviceTimeZone: zone,
};

const details = {
  title: text(120).optional(),
  notes: text(4000).optional(),
  projectId: id.nullable().optional(),
  tags: z.array(text(32)).max(12).optional(),
  payRateMinor: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
};

const breakSchema = z.strictObject({
  id,
  startedAt: instant,
  endedAt: instant.nullable(),
  kind: z.enum(["rest", "meal", "other"]),
});

const fixSchema = z.strictObject({
  id,
  event: z.enum(["clock_in", "clock_out", "retry"]),
  status: z.enum(["captured", "denied", "unavailable", "timeout", "unsupported", "off", "insecure"]),
  requestedAt: instant,
  capturedAt: instant.nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  accuracyM: z.number().min(0).max(1_000_000).nullable(),
  placeLabel: text(80).nullable(),
});

const goal = z.number().int().min(60).max(48 * 3600);

const revisionSnapshot = z.strictObject({ startedAt: instant, endedAt: instant.nullable(), breaks: z.array(breakSchema).max(100) });

/** A whole session as exported (backups / import). */
export const sessionSchema = z.strictObject({
  id,
  originEventId: id,
  originalStartedAt: instant,
  startedAt: instant,
  endedAt: instant.nullable(),
  origin: z.enum(["timer", "manual"]),
  reportingTimeZone: zone,
  startTimeZone: zone,
  endTimeZone: zone.nullable(),
  goalSeconds: goal,
  title: text(120),
  notes: text(4000),
  projectId: id.nullable(),
  tags: z.array(text(32)).max(12),
  payRateMinor: z.number().int().min(0).max(1_000_000_000).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  mood: z.number().int().min(1).max(5).nullable(),
  energy: z.number().int().min(1).max(5).nullable(),
  breaks: z.array(breakSchema).max(100),
  locations: z.array(fixSchema).max(20),
  revisions: z.array(z.strictObject({ id, at: instant, reason: text(500), previous: revisionSnapshot, updated: revisionSnapshot })).max(200),
  flags: z.array(z.enum(["device_clock_ahead", "device_clock_behind", "timezone_changed"])).max(10),
  archivedAt: instant.nullable(),
  deletedAt: instant.nullable(),
  revision: z.number().int().min(1),
  createdAt: instant,
  updatedAt: instant,
});

export const shiftEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...base, ...details, type: z.literal("clock_in"), sessionId: id, goalSeconds: goal, reportingTimeZone: zone }),
  z.strictObject({ ...base, type: z.literal("break_start"), sessionId: id, breakId: id, kind: z.enum(["rest", "meal", "other"]).optional() }),
  z.strictObject({ ...base, type: z.literal("break_end"), sessionId: id, breakId: id }),
  z.strictObject({ ...base, type: z.literal("clock_out"), sessionId: id }),
  z.strictObject({ ...base, type: z.literal("location"), sessionId: id, fix: fixSchema }),
  z.strictObject({ ...base, type: z.literal("location_delete"), sessionId: id, fixId: id }),
  z.strictObject({
    ...base,
    type: z.literal("annotate"),
    sessionId: id,
    changes: z.strictObject({
      ...details,
      mood: z.number().int().min(1).max(5).nullable().optional(),
      energy: z.number().int().min(1).max(5).nullable().optional(),
      goalSeconds: goal.optional(),
      archived: z.boolean().optional(),
    }),
  }),
  z.strictObject({
    ...base,
    type: z.literal("correct"),
    sessionId: id,
    expectedRevision: z.number().int().min(1),
    reason: text(500),
    startedAt: instant.optional(),
    endedAt: instant.nullable().optional(),
    breaks: z.array(breakSchema).max(100).optional(),
    allowOverlap: z.boolean().optional(),
  }),
  z.strictObject({
    ...base,
    ...details,
    type: z.literal("manual_create"),
    sessionId: id,
    startedAt: instant,
    endedAt: instant,
    breaks: z.array(breakSchema).max(100),
    goalSeconds: goal,
    reportingTimeZone: zone,
    allowOverlap: z.boolean().optional(),
  }),
  z.strictObject({ ...base, type: z.literal("rezone"), sessionId: id, reportingTimeZone: zone, expectedRevision: z.number().int().min(1) }),
  z.strictObject({ ...base, type: z.literal("import_session"), sessionId: id, session: sessionSchema, allowOverlap: z.boolean().optional() }),
  z.strictObject({ ...base, type: z.literal("delete"), sessionId: id }),
  z.strictObject({ ...base, type: z.literal("restore"), sessionId: id }),
  z.strictObject({ ...base, type: z.literal("purge"), sessionId: id }),
]);

export const syncBatchSchema = z.strictObject({
  events: z.array(z.unknown()).min(1).max(100),
});

export function parseShiftEvent(value: unknown): { ok: true; event: ShiftEvent } | { ok: false; message: string } {
  const parsed = shiftEventSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: `Invalid event: ${issue.path.join(".") || "body"} ${issue.message}` };
  }
  return { ok: true, event: parsed.data as ShiftEvent };
}
