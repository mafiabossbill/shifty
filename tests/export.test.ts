import { describe, expect, it } from "vitest";

import { allocationsCsv, buildBackup, csvCell, planImport, sessionsCsv } from "@/lib/export";
import { clockInEvent, clockOutEvent, locationEvent, type EventContext } from "@/lib/shifts/events";
import { defaultCompanion, defaultSettings, type ProfileState } from "@/lib/shifts/profile";
import { applyEvent } from "@/lib/shifts/reducer";
import { EMPTY_STATE, type ShiftEvent, type ShiftSession, type ShiftState } from "@/lib/shifts/types";
import { fromWallClockInput } from "@/lib/time/zone";

const DAR = "Africa/Dar_es_Salaam";
const at = (v: string) => fromWallClockInput(v, DAR)!;
let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const ctx = (t: string): EventContext => ({ now: at(t), deviceTimeZone: DAR, newId });
const apply = (s: ShiftState, e: ShiftEvent) => {
  const r = applyEvent(s, e);
  if (!r.ok) throw new Error(r.error.message);
  return r.state;
};
const profile: ProfileState = { settings: defaultSettings(DAR), projects: [], places: [], activities: [], companion: defaultCompanion(), ledger: [], achievements: [] };

function overnight() {
  const inn = clockInEvent(ctx("2026-10-26T18:00"), { goalSeconds: 57600, reportingTimeZone: DAR, title: "=HYPERLINK(\"x\")" });
  let s = apply(EMPTY_STATE, inn);
  s = apply(
    s,
    locationEvent(ctx("2026-10-26T18:00"), inn.sessionId, { event: "clock_in", status: "captured", requestedAt: at("2026-10-26T18:00"), capturedAt: at("2026-10-26T18:00"), latitude: -6.8161, longitude: 39.2803, accuracyM: 12, placeLabel: "Office" }),
  );
  s = apply(s, clockOutEvent(ctx("2026-10-27T10:00"), inn.sessionId));
  return { state: s, id: inn.sessionId };
}

const importEvent = (session: ShiftSession): ShiftEvent => ({ id: newId(), at: 1_800_000_000_000, recordedAt: 1_800_000_000_000, deviceTimeZone: DAR, type: "import_session", sessionId: session.id, session });

describe("export", () => {
  it("JSON backup carries UTC instants, zone, allocations and audit, and can redact location", () => {
    const { state } = overnight();
    const sessions = Object.values(state.sessions);
    const full = buildBackup(sessions, profile, at("2026-10-28T09:00"), { redactLocation: false, includeTrash: true });
    expect(full.sessions[0].reportingTimeZone).toBe(DAR);
    expect(full.sessions[0].derived.allocations).toEqual([
      { date: "2026-10-26", netMs: 6 * 3_600_000, breakMs: 0 },
      { date: "2026-10-27", netMs: 10 * 3_600_000, breakMs: 0 },
    ]);
    expect(full.sessions[0].locations[0].latitude).toBe(-6.8161);
    const red = buildBackup(sessions, profile, 0, { redactLocation: true, includeTrash: true });
    expect(red.sessions[0].locations[0].latitude).toBeNull();
    expect(JSON.stringify(red)).not.toContain("39.28");
  });

  it("CSV has the original instants and neutralises formulas", () => {
    const { state } = overnight();
    const out = sessionsCsv(Object.values(state.sessions), 0, { redactLocation: false, includeTrash: false });
    expect(out).toContain("2026-10-26T15:00:00.000Z");
    expect(out).toContain("'=HYPERLINK");
    expect(csvCell("-5")).toBe("-5");
    expect(csvCell("@sum")).toBe("'@sum");
    const alloc = allocationsCsv(Object.values(state.sessions), 0).trim().split("\r\n");
    expect(alloc).toHaveLength(3);
    expect(alloc[1]).toMatch(/^2026-10-26,/);
  });
});

describe("import", () => {
  it("dry run plans adds, skips what's already here and refuses overlaps", () => {
    const { state, id } = overnight();
    const text = JSON.stringify(buildBackup(Object.values(state.sessions), profile, 0, { redactLocation: false, includeTrash: false }));
    const onEmpty = planImport(text, EMPTY_STATE, importEvent);
    expect(onEmpty.ok).toBe(true);
    expect(onEmpty.add.map((s) => s.id)).toEqual([id]);
    const again = planImport(text, state, importEvent);
    expect(again.add).toHaveLength(0);
    expect(again.alreadyHere).toHaveLength(1);

    // A different session at the same time conflicts.
    const other = apply(EMPTY_STATE, clockInEvent(ctx("2026-10-26T20:00"), { goalSeconds: 57600, reportingTimeZone: DAR }));
    expect(planImport(text, other, importEvent).conflicts).toHaveLength(1);
  });

  it("an imported session is identical, keeps its origin and history, and allocates the same", () => {
    const { state, id } = overnight();
    const text = JSON.stringify(buildBackup(Object.values(state.sessions), profile, 0, { redactLocation: false, includeTrash: false }));
    const plan = planImport(text, EMPTY_STATE, importEvent);
    const restored = apply(EMPTY_STATE, importEvent(plan.add[0]));
    const s = restored.sessions[id];
    expect(s.origin).toBe("timer");
    expect(s.startedAt).toBe(state.sessions[id].startedAt);
    expect(s.locations).toEqual(state.sessions[id].locations);
  });

  it("rejects junk with a sentence", () => {
    expect(planImport("nope", EMPTY_STATE, importEvent).message).toMatch(/valid JSON/);
    expect(planImport("{}", EMPTY_STATE, importEvent).message).toMatch(/SHIFTY backup/);
    const bad = planImport(JSON.stringify({ format: "shifty-backup", version: 1, sessions: [{ id: "x" }] }), EMPTY_STATE, importEvent);
    expect(bad.invalid).toHaveLength(1);
  });
});
