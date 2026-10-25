/** Privacy centre: every captured location point, newest first, with what it belongs to. Pure. */
import { smartTitle } from "@/lib/format";
import type { ShiftSession } from "@/lib/shifts/types";
import { wallClock } from "@/lib/time/zone";

/** The session's title, or the same friendly default the rest of the app shows ("Evening shift at Office"). */
export function sessionLabel(s: Pick<ShiftSession, "title" | "startedAt" | "reportingTimeZone" | "locations">): string {
  if (s.title.trim()) return s.title;
  const place = s.locations.find((l) => l.event === "clock_in" && l.placeLabel)?.placeLabel ?? null;
  return smartTitle(wallClock(s.startedAt, s.reportingTimeZone).hour, place);
}

export interface LocationPoint {
  sessionId: string;
  fixId: string;
  sessionTitle: string;
  sessionStartedAt: number;
  reportingTimeZone: string;
  event: "clock_in" | "clock_out" | "retry";
  at: number;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  placeLabel: string | null;
  inTrash: boolean;
}

export function locationPoints(sessions: readonly ShiftSession[]): LocationPoint[] {
  const out: LocationPoint[] = [];
  for (const s of sessions) {
    for (const f of s.locations) {
      if (f.status !== "captured" || f.latitude === null || f.longitude === null) continue;
      out.push({
        sessionId: s.id,
        fixId: f.id,
        sessionTitle: sessionLabel(s),
        sessionStartedAt: s.startedAt,
        reportingTimeZone: s.reportingTimeZone,
        event: f.event,
        at: f.capturedAt ?? f.requestedAt,
        latitude: f.latitude,
        longitude: f.longitude,
        accuracyM: f.accuracyM,
        placeLabel: f.placeLabel,
        inTrash: s.deletedAt !== null,
      });
    }
  }
  return out.sort((a, b) => b.at - a.at || a.fixId.localeCompare(b.fixId));
}

/** How many points a retention setting would delete now. */
export function pointsOlderThan(points: readonly LocationPoint[], days: number | null, now: number): number {
  if (days === null) return 0;
  const cutoff = now - days * 86_400_000;
  return points.filter((p) => p.at < cutoff).length;
}

export const EVENT_WORDS: Record<LocationPoint["event"], string> = { clock_in: "Clock-in", clock_out: "Clock-out", retry: "Retry" };

export const RETENTION_OPTIONS = [
  { value: "30", label: "30 days", days: 30 },
  { value: "90", label: "90 days", days: 90 },
  { value: "365", label: "1 year", days: 365 },
  { value: "keep", label: "Keep", days: null },
] as const;

export function retentionValue(days: number | null): (typeof RETENTION_OPTIONS)[number]["value"] {
  return RETENTION_OPTIONS.find((o) => o.days === days)?.value ?? (days === null ? "keep" : "90");
}
