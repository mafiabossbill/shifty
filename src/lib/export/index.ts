/**
 * The person owns their data: JSON backup (complete, re-importable) and CSV (sessions + day allocations)
 * with original UTC instants, reporting zones, allocations and audit metadata. Location can be redacted.
 * Import is always dry-run first: the plan says exactly what would be added, skipped and why.
 */
import { applyEvent } from "@/lib/shifts/reducer";
import { sessionSchema } from "@/lib/shifts/schema";
import type { ProfileState } from "@/lib/shifts/profile";
import type { ShiftEvent, ShiftSession, ShiftState } from "@/lib/shifts/types";
import { allocateByDay, sessionMetrics } from "@/lib/time/allocate";
import { localDateOf, toWallClockInput } from "@/lib/time/zone";

export const BACKUP_FORMAT = "shifty-backup";
export const BACKUP_VERSION = 1;

export interface ExportOptions {
  /** Drop coordinates and accuracy (statuses and place labels stay). */
  redactLocation: boolean;
  includeTrash: boolean;
}

function redact(s: ShiftSession, opts: ExportOptions): ShiftSession {
  if (!opts.redactLocation) return s;
  return { ...s, locations: s.locations.map((l) => ({ ...l, latitude: null, longitude: null, accuracyM: null, status: l.status === "captured" ? "off" : l.status })) };
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  locationRedacted: boolean;
  sessions: (ShiftSession & { derived: { elapsedMs: number; breakMs: number; netMs: number; allocations: { date: string; netMs: number; breakMs: number }[] } })[];
  profile: Omit<ProfileState, "places"> & { places: ProfileState["places"] | [] };
}

export function buildBackup(sessions: readonly ShiftSession[], profile: ProfileState, now: number, opts: ExportOptions): Backup {
  const chosen = sessions.filter((s) => opts.includeTrash || s.deletedAt === null).sort((a, b) => a.startedAt - b.startedAt);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date(now).toISOString(),
    locationRedacted: opts.redactLocation,
    sessions: chosen.map((s) => {
      const m = sessionMetrics(s, now);
      return {
        ...redact(s, opts),
        derived: {
          elapsedMs: m.elapsedMs,
          breakMs: m.breakMs,
          netMs: m.netMs,
          allocations: allocateByDay(s, now, m).map((d) => ({ date: d.date, netMs: d.netMs, breakMs: d.breakMs })),
        },
      };
    }),
    profile: { ...profile, places: opts.redactLocation ? [] : profile.places },
  };
}

/** CSV cell: quoted when needed; values that a spreadsheet would run as a formula are neutralised. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const iso = (ms: number | null) => (ms === null ? "" : new Date(ms).toISOString());
const minutes = (ms: number) => Math.round(ms / 600) / 100; // two decimals, display only

export function sessionsCsv(sessions: readonly ShiftSession[], now: number, opts: ExportOptions, projectName: (id: string | null) => string = () => ""): string {
  const header = [
    "session_id", "title", "status", "origin", "started_at_utc", "ended_at_utc", "reporting_time_zone", "start_local", "end_local",
    "elapsed_ms", "break_ms", "net_ms", "net_hours", "goal_hours", "days_spanned", "project", "tags", "notes", "mood", "energy",
    "clock_in_location", "latitude", "longitude", "accuracy_m", "place", "corrections", "last_correction_reason", "in_trash",
  ];
  const rows: unknown[][] = [header];
  for (const raw of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    if (!opts.includeTrash && raw.deletedAt !== null) continue;
    const s = redact(raw, opts);
    const m = sessionMetrics(s, now);
    const fix = s.locations.find((l) => l.event === "clock_in") ?? null;
    rows.push([
      s.id, s.title, s.endedAt === null ? "running" : "completed", s.origin, iso(s.startedAt), iso(s.endedAt), s.reportingTimeZone,
      toWallClockInput(s.startedAt, s.reportingTimeZone), s.endedAt === null ? "" : toWallClockInput(s.endedAt, s.reportingTimeZone),
      m.elapsedMs, m.breakMs, m.netMs, (m.netMs / 3_600_000).toFixed(4), (s.goalSeconds / 3600).toFixed(2), allocateByDay(s, now, m).length,
      projectName(s.projectId), s.tags.join(" "), s.notes, s.mood ?? "", s.energy ?? "",
      fix?.status ?? "", fix?.latitude ?? "", fix?.longitude ?? "", fix?.accuracyM ?? "", fix?.placeLabel ?? "",
      s.revisions.length, s.revisions.at(-1)?.reason ?? "", s.deletedAt === null ? "no" : "yes",
    ]);
  }
  return csv(rows);
}

export function allocationsCsv(sessions: readonly ShiftSession[], now: number): string {
  const rows: unknown[][] = [["date", "session_id", "session_anchor_date", "reporting_time_zone", "net_ms", "break_ms", "elapsed_ms", "net_minutes"]];
  const all = sessions.filter((s) => s.deletedAt === null).flatMap((s) => allocateByDay(s, now).map((d) => ({ d, s })));
  all.sort((a, b) => a.d.date.localeCompare(b.d.date) || a.s.startedAt - b.s.startedAt);
  for (const { d, s } of all) {
    rows.push([d.date, s.id, localDateOf(s.startedAt, s.reportingTimeZone), s.reportingTimeZone, d.netMs, d.breakMs, d.elapsedMs, minutes(d.netMs)]);
  }
  return csv(rows);
}

export interface ImportPlan {
  ok: boolean;
  message: string | null;
  add: ShiftSession[];
  alreadyHere: ShiftSession[];
  conflicts: { session: ShiftSession; reason: string }[];
  invalid: { index: number; reason: string }[];
  profile: Backup["profile"] | null;
}

/** Reads a backup file's text and plans the import against the current state. Changes nothing. */
export function planImport(text: string, state: ShiftState, makeEvent: (s: ShiftSession) => ShiftEvent): ImportPlan {
  const empty: ImportPlan = { ok: false, message: null, add: [], alreadyHere: [], conflicts: [], invalid: [], profile: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ...empty, message: "That file isn't valid JSON. Choose a SHIFTY backup (.json)." };
  }
  const doc = parsed as Partial<Backup> | null;
  if (!doc || doc.format !== BACKUP_FORMAT || !Array.isArray(doc.sessions)) return { ...empty, message: "That file isn't a SHIFTY backup." };
  if ((doc.version ?? 0) > BACKUP_VERSION) return { ...empty, message: "This backup was made by a newer SHIFTY. Update the app and try again." };
  const plan: ImportPlan = { ...empty, ok: true, profile: (doc.profile as Backup["profile"]) ?? null };
  let working = state;
  doc.sessions.forEach((raw, index) => {
    const { derived: _derived, ...rest } = raw as ShiftSession & { derived?: unknown };
    void _derived;
    const result = sessionSchema.safeParse(rest);
    if (!result.success) {
      plan.invalid.push({ index, reason: result.error.issues[0]?.message ?? "Invalid session" });
      return;
    }
    const session = result.data as ShiftSession;
    if (working.sessions[session.id]) {
      plan.alreadyHere.push(session);
      return;
    }
    const applied = applyEvent(working, makeEvent(session));
    if (!applied.ok) {
      plan.conflicts.push({ session, reason: applied.error.message });
      return;
    }
    working = applied.state;
    plan.add.push(session);
  });
  return plan;
}
