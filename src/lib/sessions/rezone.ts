/**
 * Rezone preview: how a session's day contributions change if its reporting timezone changes. The
 * instants (and so the totals) never change — only where the midnights fall.
 */
import type { ShiftSession } from "@/lib/shifts/types";
import { allocateByDay } from "@/lib/time/allocate";
import type { LocalDate } from "@/lib/time/zone";

export interface RezoneRow {
  date: LocalDate;
  beforeMs: number;
  afterMs: number;
}

export function rezonePreview(session: ShiftSession, zone: string, now: number): RezoneRow[] {
  const before = allocateByDay(session, now);
  const after = allocateByDay({ ...session, reportingTimeZone: zone }, now);
  const rows = new Map<LocalDate, RezoneRow>();
  for (const d of before) rows.set(d.date, { date: d.date, beforeMs: d.netMs, afterMs: 0 });
  for (const d of after) rows.set(d.date, { ...(rows.get(d.date) ?? { date: d.date, beforeMs: 0, afterMs: 0 }), afterMs: d.netMs });
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function rezoneChanges(rows: readonly RezoneRow[]): boolean {
  return rows.some((r) => r.beforeMs !== r.afterMs);
}

/** Every zone the runtime knows (falls back to a short list), with the ones in use first. */
export function zoneOptions(inUse: readonly string[]): string[] {
  let all: string[] = [];
  try {
    all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    all = [];
  }
  if (all.length === 0) all = ["UTC", "Africa/Dar_es_Salaam", "Africa/Nairobi", "Europe/London", "Europe/Berlin", "America/New_York", "Asia/Dubai", "Asia/Kolkata"];
  const first = [...new Set(inUse.filter(Boolean))];
  return [...first, ...all.filter((z) => !first.includes(z))];
}
