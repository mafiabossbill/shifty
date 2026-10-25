/** Builders for the events the UI records. Each gets a fresh device-generated id at the moment of the action. */
import type { BreakKind, LocationFix, SessionDetails, ShiftBreak, ShiftEvent } from "./types";

export interface EventContext {
  /** Authoritative "now" (device clock corrected by the known server offset). */
  now: number;
  deviceTimeZone: string;
  newId?: () => string;
}

const uuid = (ctx: EventContext) => (ctx.newId ?? (() => crypto.randomUUID()))();

function base(ctx: EventContext, at = ctx.now) {
  return { id: uuid(ctx), at, recordedAt: ctx.now, deviceTimeZone: ctx.deviceTimeZone };
}

export function clockInEvent(ctx: EventContext, input: { goalSeconds: number; reportingTimeZone: string } & SessionDetails): Extract<ShiftEvent, { type: "clock_in" }> {
  return { ...base(ctx), type: "clock_in", sessionId: uuid(ctx), ...input };
}

export function breakStartEvent(ctx: EventContext, sessionId: string, kind: BreakKind = "rest"): Extract<ShiftEvent, { type: "break_start" }> {
  return { ...base(ctx), type: "break_start", sessionId, breakId: uuid(ctx), kind };
}

export function breakEndEvent(ctx: EventContext, sessionId: string, breakId: string): Extract<ShiftEvent, { type: "break_end" }> {
  return { ...base(ctx), type: "break_end", sessionId, breakId };
}

export function clockOutEvent(ctx: EventContext, sessionId: string): Extract<ShiftEvent, { type: "clock_out" }> {
  return { ...base(ctx), type: "clock_out", sessionId };
}

export function locationEvent(ctx: EventContext, sessionId: string, fix: Omit<LocationFix, "id"> & { id?: string }): Extract<ShiftEvent, { type: "location" }> {
  return { ...base(ctx), type: "location", sessionId, fix: { ...fix, id: fix.id ?? uuid(ctx) } };
}

export function newBreakId(ctx: EventContext): string {
  return uuid(ctx);
}

export type CorrectionInput = { reason: string; expectedRevision: number; startedAt?: number; endedAt?: number | null; breaks?: ShiftBreak[]; allowOverlap?: boolean };

export function correctEvent(ctx: EventContext, sessionId: string, input: CorrectionInput): Extract<ShiftEvent, { type: "correct" }> {
  return { ...base(ctx), type: "correct", sessionId, ...input };
}

export function manualCreateEvent(
  ctx: EventContext,
  input: { startedAt: number; endedAt: number; breaks: ShiftBreak[]; goalSeconds: number; reportingTimeZone: string; allowOverlap?: boolean } & SessionDetails,
): Extract<ShiftEvent, { type: "manual_create" }> {
  return { ...base(ctx), type: "manual_create", sessionId: uuid(ctx), ...input };
}

export function simpleEvent<T extends "delete" | "restore" | "purge">(ctx: EventContext, type: T, sessionId: string) {
  return { ...base(ctx), type, sessionId } as Extract<ShiftEvent, { type: T }>;
}
