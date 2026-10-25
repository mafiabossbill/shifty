/** Export / import glue for Settings → Your data. Pure. */
import type { ImportPlan } from "@/lib/export";
import type { ShiftEvent, ShiftSession } from "@/lib/shifts/types";

export function importEventFor(session: ShiftSession, ctx: { id: string; now: number; deviceTimeZone: string }): ShiftEvent {
  return { id: ctx.id, at: ctx.now, recordedAt: ctx.now, deviceTimeZone: ctx.deviceTimeZone, type: "import_session", sessionId: session.id, session };
}

export type ExportKind = "backup" | "sessions" | "allocations";

export function exportFileName(kind: ExportKind, today: string): string {
  if (kind === "backup") return `shifty-backup-${today}.json`;
  return `shifty-${kind === "sessions" ? "sessions" : "day-allocations"}-${today}.csv`;
}

/** One sentence for the dry run. */
export function planSentence(plan: ImportPlan): string {
  if (!plan.ok) return plan.message ?? "That file can't be imported.";
  const n = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  const parts = [`${n(plan.add.length, "session")} to add`];
  if (plan.alreadyHere.length) parts.push(`${plan.alreadyHere.length} already here`);
  if (plan.conflicts.length) parts.push(`${n(plan.conflicts.length, "conflict")}`);
  if (plan.invalid.length) parts.push(`${plan.invalid.length} unreadable`);
  return `${parts.join(", ")}.`;
}
