import { describe, expect, it } from "vitest";

import { exportFileName, importEventFor, planSentence } from "@/lib/settings/data";
import { goalLabel, parseGoal, splitGoal } from "@/lib/settings/goal";
import { locationPoints, pointsOlderThan, retentionValue } from "@/lib/settings/locations";
import { monthReport, reportMonths } from "@/lib/settings/report";
import { groupZones, offsetLabel, parseOffsetQuery, runtimeZones, searchZones, zoneDisplay, zoneOption, zoneOptions } from "@/lib/settings/timezones";
import { planImport } from "@/lib/export";
import { sessionFacts } from "@/lib/reports";
import { clockInEvent, clockOutEvent, locationEvent, type EventContext } from "@/lib/shifts/events";
import { applyEvent } from "@/lib/shifts/reducer";
import { EMPTY_STATE, type ShiftEvent, type ShiftState } from "@/lib/shifts/types";
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

function overnight(state: ShiftState = EMPTY_STATE, start = "2026-10-26T18:00", end = "2026-10-27T10:00") {
  const inn = clockInEvent(ctx(start), { goalSeconds: 57600, reportingTimeZone: DAR });
  let s = apply(state, inn);
  s = apply(s, locationEvent(ctx(start), inn.sessionId, { event: "clock_in", status: "captured", requestedAt: at(start), capturedAt: at(start), latitude: -6.8161, longitude: 39.2803, accuracyM: 12, placeLabel: "Office" }));
  s = apply(s, locationEvent(ctx(start), inn.sessionId, { event: "retry", status: "denied", requestedAt: at(start), capturedAt: null, latitude: null, longitude: null, accuracyM: null, placeLabel: null }));
  s = apply(s, clockOutEvent(ctx(end), inn.sessionId));
  return { state: s, id: inn.sessionId };
}

describe("goal parsing", () => {
  it("splits and labels seconds", () => {
    expect(splitGoal(57600)).toEqual({ hours: 16, minutes: 0 });
    expect(splitGoal(27000)).toEqual({ hours: 7, minutes: 30 });
    expect(goalLabel(57600)).toBe("16h");
    expect(goalLabel(27000)).toBe("7h 30m");
    expect(goalLabel(2700)).toBe("45m");
  });
  it("accepts 1 minute to 48 hours, blanks as zero", () => {
    expect(parseGoal("16", "")).toEqual({ ok: true, seconds: 57600 });
    expect(parseGoal("", "1")).toEqual({ ok: true, seconds: 60 });
    expect(parseGoal("48", "0")).toEqual({ ok: true, seconds: 48 * 3600 });
  });
  it("refuses out of range and non-integers with a sentence", () => {
    expect(parseGoal("0", "0")).toEqual({ ok: false, error: "The goal must be at least 1 minute." });
    expect(parseGoal("48", "1")).toEqual({ ok: false, error: "The goal can be at most 48 hours." });
    expect(parseGoal("7.5", "0").ok).toBe(false);
    expect(parseGoal("7", "60")).toEqual({ ok: false, error: "Minutes go up to 59." });
    expect(parseGoal("-1", "0").ok).toBe(false);
    expect(parseGoal("abc", "").ok).toBe(false);
  });
});

describe("timezones", () => {
  const now = Date.UTC(2026, 9, 25, 12);
  it("labels offsets", () => {
    expect(offsetLabel(180)).toBe("GMT+3");
    expect(offsetLabel(-330)).toBe("GMT−5:30");
    expect(offsetLabel(0)).toBe("GMT");
  });
  it("reads city, region and offset", () => {
    expect(zoneOption(DAR, now)).toMatchObject({ city: "Dar es Salaam", region: "Africa", offset: "GMT+3", offsetMinutes: 180 });
    expect(zoneOption("UTC", now)).toMatchObject({ city: "UTC", region: "Other", offset: "GMT" });
    expect(zoneOption("America/Argentina/Buenos_Aires", now).city).toBe("Buenos Aires");
    expect(zoneDisplay(DAR, now)).toBe("Dar es Salaam · Africa · GMT+3");
  });
  it("has the runtime list including UTC", () => {
    const zones = runtimeZones();
    expect(zones).toContain(DAR);
    expect(zones).toContain("UTC");
  });
  it("parses offset queries", () => {
    expect(parseOffsetQuery("gmt+3")).toBe(180);
    expect(parseOffsetQuery("UTC-5")).toBe(-300);
    expect(parseOffsetQuery("+5:30")).toBe(330);
    expect(parseOffsetQuery("GMT")).toBe(0);
    expect(parseOffsetQuery("dar")).toBeNull();
  });
  it("searches by city start, word and region; groups by region with Other last", () => {
    const opts = zoneOptions(["Africa/Dar_es_Salaam", "Africa/Nairobi", "Europe/London", "America/New_York", "UTC", "Asia/Kolkata"], now);
    expect(searchZones(opts, "dar")[0].id).toBe(DAR);
    expect(searchZones(opts, "york").map((z) => z.id)).toEqual(["America/New_York"]);
    expect(searchZones(opts, "africa").map((z) => z.id)).toEqual(["Africa/Dar_es_Salaam", "Africa/Nairobi"]);
    expect(searchZones(opts, "gmt+3").map((z) => z.id).sort()).toEqual(["Africa/Dar_es_Salaam", "Africa/Nairobi"]);
    expect(searchZones(opts, "+5:30").map((z) => z.id)).toEqual(["Asia/Kolkata"]);
    expect(searchZones(opts, "  ")).toHaveLength(6);
    const groups = groupZones(opts).map((g) => g.region);
    expect(groups).toEqual(["Africa", "America", "Asia", "Europe", "Other"]);
  });
});

describe("location points", () => {
  it("lists only captured fixes, newest first, and counts retention", () => {
    const a = overnight();
    const b = overnight(a.state, "2026-10-28T18:00", "2026-10-29T06:00");
    const points = locationPoints(Object.values(b.state.sessions));
    expect(points).toHaveLength(2);
    expect(points[0].sessionId).toBe(b.id);
    expect(points[0]).toMatchObject({ latitude: -6.8161, placeLabel: "Office", event: "clock_in", inTrash: false });
    expect(pointsOlderThan(points, 1, at("2026-10-29T12:00"))).toBe(1);
    expect(pointsOlderThan(points, null, at("2026-10-29T12:00"))).toBe(0);
    expect(retentionValue(30)).toBe("30");
    expect(retentionValue(null)).toBe("keep");
  });
});

describe("month report", () => {
  it("splits an overnight session across months by calendar day", () => {
    const { state, id } = overnight(EMPTY_STATE, "2026-10-31T18:00", "2026-11-01T10:00");
    const facts = sessionFacts(Object.values(state.sessions), at("2026-11-02T00:00"));
    expect(reportMonths(facts, "2026-11-02")).toEqual(["2026-11", "2026-10"]);
    const oct = monthReport(facts, "2026-10");
    expect(oct.netMs).toBe(6 * 3_600_000);
    expect(oct.days).toEqual([{ date: "2026-10-31", netMs: 6 * 3_600_000, breakMs: 0, sessions: 1 }]);
    expect(oct.sessions.map((f) => f.session.id)).toEqual([id]);
    const nov = monthReport(facts, "2026-11");
    expect(nov.netMs).toBe(10 * 3_600_000);
    expect(monthReport(facts, "2026-11", "start").netMs).toBe(0);
  });
});

describe("import glue", () => {
  it("builds import events that the reducer accepts and words the plan", () => {
    const { state } = overnight();
    const backup = JSON.stringify({ format: "shifty-backup", version: 1, sessions: Object.values(state.sessions) });
    const make = (s: Parameters<typeof importEventFor>[0]) => importEventFor(s, { id: newId(), now: at("2026-10-30T09:00"), deviceTimeZone: DAR });
    const fresh = planImport(backup, EMPTY_STATE, make);
    expect(fresh.add).toHaveLength(1);
    expect(planSentence(fresh)).toBe("1 session to add.");
    const again = planImport(backup, state, make);
    expect(planSentence(again)).toBe("0 sessions to add, 1 already here.");
    expect(planSentence(planImport("nope", state, make))).toBe("That file isn't valid JSON. Choose a SHIFTY backup (.json).");
    expect(exportFileName("backup", "2026-10-30")).toBe("shifty-backup-2026-10-30.json");
    expect(exportFileName("allocations", "2026-10-30")).toBe("shifty-day-allocations-2026-10-30.csv");
  });
});

describe("session labels", () => {
  it("uses the title, else the friendly default with the place", async () => {
    const { sessionLabel } = await import("@/lib/settings/locations");
    const { state, id } = overnight();
    const s = state.sessions[id];
    expect(sessionLabel(s)).toBe("Evening shift at Office");
    expect(sessionLabel({ ...s, title: "Stocktake" })).toBe("Stocktake");
  });
});
