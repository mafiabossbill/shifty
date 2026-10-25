/**
 * SHIFTY fixture for scripts/check-rls.ts. Every valid step comes from the real reducer
 * (src/lib/shifts/reducer.ts), so the database is compared with exactly what the app produces:
 * load_shift_state() must deep-equal `expectedState`. Ids are fresh per run (the check rolls back,
 * and also runs against the live project). `cases` are rule violations and other people's attempts.
 */
import { randomUUID } from "node:crypto";

import { defaultCompanion, defaultSettings, type ProfileState } from "@/lib/shifts/profile";
import { applyEvent } from "@/lib/shifts/reducer";
import { EMPTY_STATE, type ShiftEvent, type ShiftSession, type ShiftState } from "@/lib/shifts/types";

const ZONE = "Africa/Dar_es_Salaam";
const H = 3_600_000;
const M = 60_000;

interface Step {
  event: ShiftEvent;
  session: ShiftSession | null;
  sessionId: string;
  expected: number;
}
interface Case {
  key: string;
  as: "owner" | "peer" | "admin" | "outsider" | "viewer";
  event: ShiftEvent;
  session: ShiftSession | null;
  sessionId: string;
  expected: number;
}

export function shiftFixture() {
  const id = () => randomUUID();
  const T0 = Date.UTC(2026, 9, 19, 15, 0, 0, 123); // Monday 18:00:00.123 in Dar es Salaam
  const projectId = id();
  const peerProjectId = id();
  let state: ShiftState = EMPTY_STATE;
  const steps: Step[] = [];
  const ev = (at: number, rest: Record<string, unknown>) => ({ id: id(), at, recordedAt: at + 7, deviceTimeZone: ZONE, ...rest }) as unknown as ShiftEvent;
  const apply = (event: ShiftEvent) => {
    const before = state.sessions[event.sessionId] as ShiftSession | undefined;
    const result = applyEvent(state, event);
    if (!result.ok) throw new Error(`Fixture event ${event.type} rejected: ${result.error.message}`);
    state = result.state;
    steps.push({ event, session: result.session, sessionId: event.sessionId, expected: before?.revision ?? 0 });
  };

  // A: overnight timer session with locations, a break, a correction (moves a break, adds one) and notes.
  const A = id();
  apply(ev(T0, { type: "clock_in", sessionId: A, goalSeconds: 16 * 3600, reportingTimeZone: ZONE, title: "Night shift", projectId, tags: ["Ward 3", "night"], payRateMinor: 250_000, currency: "TZS" }));
  const fixCaptured = { id: id(), event: "clock_in", status: "captured", requestedAt: T0 + 1, capturedAt: T0 + 1801, latitude: -6.792354123456789, longitude: 39.20832871234567, accuracyM: 12.5, placeLabel: "Clinic" };
  apply(ev(T0 + 1802, { type: "location", sessionId: A, fix: fixCaptured }));
  const breakA = id();
  apply(ev(T0 + 8 * H + 1, { type: "break_start", sessionId: A, breakId: breakA, kind: "meal" }));
  apply(ev(T0 + 8 * H + 30 * M + 1, { type: "break_end", sessionId: A, breakId: breakA }));
  const fixDenied = { id: id(), event: "retry", status: "denied", requestedAt: T0 + 2, capturedAt: null, latitude: null, longitude: null, accuracyM: null, placeLabel: null };
  apply(ev(T0 + 3 * H, { type: "location", sessionId: A, fix: fixDenied }));
  apply(ev(T0 + 16 * H + 999, { type: "clock_out", sessionId: A }));
  const a = state.sessions[A];
  const moved = { ...a.breaks[0], startedAt: a.breaks[0].startedAt + 5 * M, endedAt: (a.breaks[0].endedAt ?? 0) + 5 * M };
  const added = { id: id(), startedAt: T0 + 12 * H, endedAt: T0 + 12 * H + 15 * M + 333, kind: "rest" };
  apply(ev(T0 + 17 * H, { type: "correct", sessionId: A, expectedRevision: a.revision, reason: "Forgot to clock in on time", startedAt: T0 - 15 * M + 1, breaks: [moved, added] }));
  apply(ev(T0 + 17 * H + 1, { type: "annotate", sessionId: A, changes: { mood: 4, energy: 2, notes: "Busy night\nward 3", archived: true } }));
  apply(ev(T0 + 17 * H + 2, { type: "location_delete", sessionId: A, fixId: fixDenied.id }));

  // B: manual entry last week, another reporting zone, then moved to the trash.
  const B = id();
  const B0 = T0 - 7 * 24 * H;
  apply(ev(T0 + 18 * H, { type: "manual_create", sessionId: B, startedAt: B0, endedAt: B0 + 9 * H + 45 * M, breaks: [{ id: id(), startedAt: B0 + 4 * H, endedAt: B0 + 4 * H + 45 * M, kind: "meal" }], goalSeconds: 8 * 3600, reportingTimeZone: "Europe/London", title: "Backfill" }));
  apply(ev(T0 + 18 * H + 5, { type: "delete", sessionId: B }));

  // C: manual entry with a captured location, deleted, then purged (its events stay, coordinates redacted).
  const C = id();
  const C0 = T0 - 3 * 24 * H;
  apply(ev(T0 + 19 * H, { type: "manual_create", sessionId: C, startedAt: C0, endedAt: C0 + 2 * H, breaks: [], goalSeconds: 3600, reportingTimeZone: ZONE }));
  apply(ev(T0 + 19 * H + 1, { type: "location", sessionId: C, fix: { ...fixCaptured, id: id(), event: "retry", requestedAt: C0 + 5, capturedAt: C0 + 9 } }));
  apply(ev(T0 + 19 * H + 2, { type: "delete", sessionId: C }));
  apply(ev(T0 + 19 * H + 3, { type: "purge", sessionId: C }));

  // D: running session; a correction SWAPS two breaks (needs the deferred overlap check), then a rezone.
  const D = id();
  const D0 = T0 + 20 * H;
  const [d1, d2] = [id(), id()];
  apply(ev(D0, { type: "clock_in", sessionId: D, goalSeconds: 16 * 3600, reportingTimeZone: ZONE }));
  apply(ev(D0 + H, { type: "break_start", sessionId: D, breakId: d1, kind: "rest" }));
  apply(ev(D0 + 2 * H, { type: "break_end", sessionId: D, breakId: d1 }));
  apply(ev(D0 + 3 * H, { type: "break_start", sessionId: D, breakId: d2, kind: "meal" }));
  apply(ev(D0 + 4 * H, { type: "break_end", sessionId: D, breakId: d2 }));
  const dBefore = state.sessions[D];
  apply(ev(D0 + 5 * H, { type: "correct", sessionId: D, expectedRevision: dBefore.revision, reason: "Swapped the breaks", breaks: [
    { id: d1, startedAt: D0 + 3 * H, endedAt: D0 + 4 * H, kind: "rest" },
    { id: d2, startedAt: D0 + H, endedAt: D0 + 2 * H, kind: "meal" },
  ] }));
  apply(ev(D0 + 5 * H + 1, { type: "rezone", sessionId: D, reportingTimeZone: "Europe/Berlin", expectedRevision: state.sessions[D].revision }));

  // Rule violations against the final state: each must fail and leave nothing behind.
  const d = state.sessions[D];
  const E = id();
  const next = (patch: Partial<ShiftSession>): ShiftSession => ({ ...d, ...patch, revision: d.revision + 1 });
  const onD = (key: string, as: Case["as"], session: ShiftSession, expected = d.revision): Case => ({ key, as, event: ev(D0 + 6 * H, { type: "annotate", sessionId: D, changes: {} }), session, sessionId: D, expected });
  const brk = (startedAt: number, endedAt: number | null) => ({ id: id(), startedAt, endedAt, kind: "rest" as const });
  const missing = id();
  const cases: Case[] = [
    { key: "duplicate", as: "owner", ...steps[0] },
    { key: "second_active", as: "owner", event: ev(D0 + 6 * H, { type: "clock_in", sessionId: E, goalSeconds: 3600, reportingTimeZone: ZONE }), session: { ...d, id: E, originEventId: id(), breaks: [], locations: [], revisions: [], revision: 1 }, sessionId: E, expected: 0 },
    onD("break_overlap", "owner", next({ breaks: [brk(D0 + H, D0 + 2 * H), brk(D0 + 90 * M, D0 + 150 * M)] })),
    onD("break_outside", "owner", next({ breaks: [brk(D0 - M, D0 + M)] })),
    onD("open_break_finished", "owner", next({ endedAt: D0 + 6 * H, endTimeZone: ZONE, breaks: [...d.breaks, brk(D0 + 5 * H, null)] })),
    onD("chronology", "owner", next({ endedAt: d.startedAt - 1000, breaks: [] })),
    onD("stale_revision", "owner", { ...d, title: "stale" }, d.revision - 1),
    onD("captured_without_coordinates", "owner", next({ locations: [{ id: id(), event: "retry", status: "captured", requestedAt: D0 + 1, capturedAt: D0 + 2, latitude: null, longitude: null, accuracyM: null, placeLabel: null }] })),
    onD("foreign_project", "owner", next({ projectId: peerProjectId })),
    { key: "not_found", as: "owner", event: ev(D0 + 6 * H, { type: "annotate", sessionId: missing, changes: {} }), session: { ...d, id: missing, revision: 2 }, sessionId: missing, expected: 1 },
    onD("peer_update", "peer", next({ title: "hijacked" })),
    onD("admin_update", "admin", next({ title: "hijacked" })),
    onD("outsider_update", "outsider", next({ title: "hijacked" })),
    { key: "viewer_commit", as: "viewer", event: ev(D0 + 6 * H, { type: "clock_in", sessionId: E, goalSeconds: 3600, reportingTimeZone: ZONE }), session: { ...d, id: E, breaks: [], locations: [], revisions: [], revision: 1 }, sessionId: E, expected: 0 },
  ];

  const profile: ProfileState = {
    settings: defaultSettings(ZONE, T0 - 5000),
    projects: [{ id: projectId, name: "Clinic", color: "teal", archived: false, updatedAt: T0 - 1000 }],
    places: [{ id: id(), label: "Clinic", latitude: -6.7923541, longitude: 39.2083287, radiusM: 150, updatedAt: T0 - 999 }],
    activities: [{ id: "review-2026-10-19", type: "week_review", key: "2026-10-19", at: T0 + 17 * H }],
    companion: defaultCompanion(T0 - 4000),
    ledger: [
      { key: "first_clock_in", rule: "first_clock_in", xp: 50, sourceSessionId: null, at: T0 },
      { key: `complete:${A}`, rule: "complete", xp: 20, sourceSessionId: A, at: T0 + 16 * H + 999 },
    ],
    achievements: [{ code: "first_clock_in", earnedAt: T0, sourceSessionId: A }],
  };

  return {
    sql: { steps, cases, profile, peerProjectId, A, C },
    expectedState: state,
    expectedProfile: profile,
  };
}
