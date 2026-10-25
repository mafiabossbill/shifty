/**
 * One view model per session for the Sessions screens: metrics, day allocations, the display title, the
 * clock-in place and the project. Pure. Completed sessions are immutable objects (the reducer replaces a
 * session on every change), so their facts are cached by identity; only a running session is recomputed.
 */
import { smartTitle } from "@/lib/format";
import type { Project } from "@/lib/shifts/profile";
import type { LocationFix, ShiftSession } from "@/lib/shifts/types";
import { allocateByDay, anchorDate, sessionMetrics, type DayAllocation, type SessionMetrics } from "@/lib/time/allocate";
import { wallClock, type LocalDate } from "@/lib/time/zone";

export interface SessionPlace {
  /** Filter key: `place:<label>`, `unlabelled` or `none`. */
  key: string;
  /** What to show; null when no location was captured. */
  label: string | null;
}

export interface SessionRow {
  session: ShiftSession;
  metrics: SessionMetrics;
  days: DayAllocation[];
  anchor: LocalDate;
  /** The session's own title, or a friendly one from the start hour and place. */
  title: string;
  place: SessionPlace;
  project: Project | null;
}

interface Facts {
  metrics: SessionMetrics;
  days: DayAllocation[];
  anchor: LocalDate;
}

const cache = new WeakMap<ShiftSession, Facts>();

function factsOf(session: ShiftSession, now: number): Facts {
  if (session.endedAt !== null) {
    const hit = cache.get(session);
    if (hit) return hit;
  }
  const metrics = sessionMetrics(session, now);
  const facts = { metrics, days: allocateByDay(session, now, metrics), anchor: anchorDate(session) };
  if (session.endedAt !== null) cache.set(session, facts);
  return facts;
}

export const NOT_CAPTURED_KEY = "none";
export const UNLABELLED_KEY = "unlabelled";
export const UNLABELLED_LABEL = "Unlabelled spot";

/** The clock-in place (or, failing that, any captured point). Never invents a place. */
export function placeOf(session: Pick<ShiftSession, "locations">): SessionPlace {
  const captured = (fixes: LocationFix[]) => fixes.filter((f) => f.status === "captured");
  const fixes = captured(session.locations);
  const fix = fixes.find((f) => f.event === "clock_in") ?? fixes[0] ?? null;
  if (!fix) return { key: NOT_CAPTURED_KEY, label: null };
  if (fix.placeLabel) return { key: `place:${fix.placeLabel}`, label: fix.placeLabel };
  return { key: UNLABELLED_KEY, label: UNLABELLED_LABEL };
}

export function displayTitle(session: Pick<ShiftSession, "title" | "startedAt" | "reportingTimeZone">, place: SessionPlace): string {
  if (session.title.trim()) return session.title;
  const hour = wallClock(session.startedAt, session.reportingTimeZone).hour;
  return smartTitle(hour, place.key.startsWith("place:") ? place.label : null);
}

export function buildRow(session: ShiftSession, now: number, projects: readonly Project[]): SessionRow {
  const facts = factsOf(session, now);
  const place = placeOf(session);
  return {
    session,
    ...facts,
    title: displayTitle(session, place),
    place,
    project: session.projectId ? (projects.find((p) => p.id === session.projectId) ?? null) : null,
  };
}

export function buildRows(sessions: readonly ShiftSession[], now: number, projects: readonly Project[]): SessionRow[] {
  return sessions.map((s) => buildRow(s, now, projects));
}

/** Project colours as dots (the same hue reads on cream and ink). */
export const PROJECT_COLORS: Record<Project["color"], string> = {
  lilac: "#8b7bff",
  indigo: "#5b6cf0",
  teal: "#22a898",
  sage: "#7aa985",
  peach: "#f2925f",
  rose: "#e5739b",
  sky: "#4fa9e8",
  sand: "#c4a064",
};
