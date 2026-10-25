/**
 * Plain-words copy for sessions: time ranges ("18:00 → 10:00 +1"), what a correction changed
 * ("Start 18:00 → 17:40"), location accuracy and flags. Times are always in the session's reporting zone.
 */
import { formatDate, formatDuration, formatTime, type ClockFormat } from "@/lib/format";
import type { BreakKind, SessionFlag, ShiftBreak, TimeSnapshot } from "@/lib/shifts/types";
import { sessionMetrics } from "@/lib/time/allocate";
import { daysBetween, localDateOf } from "@/lib/time/zone";

/** Whole local days between two instants in a zone (0 = same date). */
export function dayOffset(from: number, to: number, zone: string): number {
  return daysBetween(localDateOf(from, zone), localDateOf(to, zone));
}

/** "18:00 → 10:00 +1", or "18:00 → now" while running. */
export function formatRange(start: number, end: number | null, zone: string, clock: ClockFormat = "24h"): string {
  const from = formatTime(start, zone, clock);
  if (end === null) return `${from} → now`;
  const n = dayOffset(start, end, zone);
  return `${from} → ${formatTime(end, zone, clock)}${n > 0 ? ` +${n}` : ""}`;
}

export const BREAK_KIND_LABEL: Record<BreakKind, string> = { rest: "Rest", meal: "Meal", other: "Other" };

function instantPair(a: number, b: number, zone: string, clock: ClockFormat): [string, string] {
  const sameDay = localDateOf(a, zone) === localDateOf(b, zone);
  const fmt = (t: number) => (sameDay ? formatTime(t, zone, clock) : `${formatDate(localDateOf(t, zone))} ${formatTime(t, zone, clock)}`);
  return [fmt(a), fmt(b)];
}

function breakSpan(b: Pick<ShiftBreak, "startedAt" | "endedAt">, zone: string, clock: ClockFormat): string {
  return b.endedAt === null ? `${formatTime(b.startedAt, zone, clock)}–now` : `${formatTime(b.startedAt, zone, clock)}–${formatTime(b.endedAt, zone, clock)}`;
}

/**
 * What changed between two snapshots, one sentence per change, in the order a person reads a shift:
 * start, end, breaks (matched by id), then the resulting net time.
 */
export function describeChanges(previous: TimeSnapshot, updated: TimeSnapshot, zone: string, clock: ClockFormat = "24h"): string[] {
  const lines: string[] = [];
  if (previous.startedAt !== updated.startedAt) {
    const [a, b] = instantPair(previous.startedAt, updated.startedAt, zone, clock);
    lines.push(`Start ${a} → ${b}`);
  }
  if (previous.endedAt !== updated.endedAt && previous.endedAt !== null && updated.endedAt !== null) {
    const [a, b] = instantPair(previous.endedAt, updated.endedAt, zone, clock);
    lines.push(`End ${a} → ${b}`);
  }
  const before = new Map(previous.breaks.map((b) => [b.id, b]));
  const after = new Map(updated.breaks.map((b) => [b.id, b]));
  for (const b of [...previous.breaks, ...updated.breaks.filter((x) => !before.has(x.id))].sort((x, y) => x.startedAt - y.startedAt)) {
    const old = before.get(b.id);
    const next = after.get(b.id);
    if (old && !next) lines.push(`Removed the break ${breakSpan(old, zone, clock)}`);
    else if (!old && next) {
      const len = next.endedAt === null ? "" : `${formatDuration(next.endedAt - next.startedAt)} `;
      lines.push(`Added a ${len}${BREAK_KIND_LABEL[next.kind].toLowerCase()} break ${breakSpan(next, zone, clock)}`);
    } else if (old && next) {
      if (old.startedAt !== next.startedAt || old.endedAt !== next.endedAt) lines.push(`Break ${breakSpan(old, zone, clock)} → ${breakSpan(next, zone, clock)}`);
      if (old.kind !== next.kind) lines.push(`Break ${breakSpan(next, zone, clock)} is now a ${BREAK_KIND_LABEL[next.kind].toLowerCase()} break`);
    }
  }
  if (previous.endedAt !== null && updated.endedAt !== null) {
    const zoneless = (t: TimeSnapshot) => sessionMetrics({ ...t, reportingTimeZone: zone }, t.endedAt ?? 0).netMs;
    const a = zoneless(previous);
    const b = zoneless(updated);
    if (a !== b) lines.push(`Net ${formatDuration(a)} → ${formatDuration(b)}`);
  }
  return lines;
}

/** "±12 m — GPS is approximate". */
export function accuracyCopy(accuracyM: number | null): string | null {
  if (accuracyM === null) return null;
  if (accuracyM <= 50) return `±${accuracyM} m — GPS is approximate`;
  if (accuracyM <= 500) return `±${accuracyM} m — only roughly here`;
  return `±${(accuracyM / 1000).toFixed(1)} km — a rough area only`;
}

export const LOCATION_EVENT_LABEL = { clock_in: "Clock-in", clock_out: "Clock-out", retry: "Retry" } as const;

export const FLAG_COPY: Record<SessionFlag, string> = {
  device_clock_ahead: "This device's clock was ahead of the real time when this was recorded. The times are kept as recorded — check them and correct if needed.",
  device_clock_behind: "This device's clock was behind the real time when this was recorded. The times are kept as recorded — check them and correct if needed.",
  timezone_changed: "Your device changed timezone during this session. Days are still split in the session's reporting timezone.",
};

/** "+1h 12m past your goal" / "2h 30m to your goal" — neutral, never praise for long hours. */
export function goalCopy(netMs: number, goalSeconds: number, running = false): string {
  const goalMs = goalSeconds * 1000;
  const goal = formatDuration(goalMs);
  if (netMs > goalMs) return `+${formatDuration(netMs - goalMs)} past your ${goal} goal`;
  if (netMs === goalMs) return `Reached your ${goal} goal`;
  return running ? `${formatDuration(goalMs - netMs)} to your ${goal} goal` : `${formatDuration(netMs)} of your ${goal} goal`;
}
