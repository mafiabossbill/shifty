import { describe, expect, it } from "vitest";

import { buildInsights, buildSessionBreakdown, levelOf, typicalStart, type InsightsInput } from "@/lib/insights/model";
import { HOLE, ringOffset, ringTracks, spokeAt, spokeLayout } from "@/lib/insights/radial";
import { recapSvg, type RecapInput } from "@/lib/insights/recap";
import { hourScale, labelEvery, linear } from "@/lib/insights/scale";
import { sessionFacts, type AllocationMode } from "@/lib/reports";
import { breakEndEvent, breakStartEvent, clockInEvent, clockOutEvent, locationEvent, type EventContext } from "@/lib/shifts/events";
import { applyEvent } from "@/lib/shifts/reducer";
import { EMPTY_STATE, visibleSessions, type ShiftEvent, type ShiftState } from "@/lib/shifts/types";
import { rangeFor } from "@/lib/reports";
import { fromWallClockInput } from "@/lib/time/zone";

const DAR = "Africa/Dar_es_Salaam";
const H = 3_600_000;
const at = (v: string) => fromWallClockInput(v, DAR)!;
let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const ctx = (t: string): EventContext => ({ now: at(t), deviceTimeZone: DAR, newId });

function apply(state: ShiftState, e: ShiftEvent) {
  const r = applyEvent(state, e);
  if (!r.ok) throw new Error(r.error.message);
  return r.state;
}

function shift(state: ShiftState, from: string, to: string | null, opts: { brk?: [string, string]; place?: string; rate?: number } = {}) {
  const inn = clockInEvent(ctx(from), { goalSeconds: 16 * 3600, reportingTimeZone: DAR, payRateMinor: opts.rate ?? null, currency: opts.rate ? "TZS" : null });
  state = apply(state, inn);
  if (opts.place !== undefined) {
    state = apply(
      state,
      locationEvent(ctx(from), inn.sessionId, {
        event: "clock_in",
        status: "captured",
        requestedAt: at(from),
        capturedAt: at(from),
        latitude: -6.7924,
        longitude: 39.2083,
        accuracyM: 10,
        placeLabel: opts.place || null,
      }),
    );
  }
  if (opts.brk) {
    const b = breakStartEvent(ctx(opts.brk[0]), inn.sessionId);
    state = apply(state, b);
    state = apply(state, breakEndEvent(ctx(opts.brk[1]), inn.sessionId, b.breakId));
  }
  if (to) state = apply(state, clockOutEvent(ctx(to), inn.sessionId));
  return { state, id: inn.sessionId };
}

function history() {
  let s = EMPTY_STATE;
  const a = shift(s, "2026-10-26T18:00", "2026-10-27T10:00", { brk: ["2026-10-27T02:00", "2026-10-27T02:30"], place: "Office", rate: 5000 });
  s = a.state;
  s = shift(s, "2026-10-31T22:00", "2026-11-01T06:00", { place: "" }).state; // crosses month (and Sat → Sun)
  s = shift(s, "2026-11-01T23:00", "2026-11-02T03:00").state; // crosses week
  s = shift(s, "2026-12-31T23:00", "2027-01-01T03:00").state; // crosses year
  return { state: s, first: a.id };
}

function input(facts: ReturnType<typeof sessionFacts>, over: Partial<InsightsInput> = {}): InsightsInput {
  return {
    facts,
    range: rangeFor("week", "2026-10-28", 1),
    kind: "week",
    mode: "calendar",
    today: "2026-10-28",
    weekStart: 1,
    heatDays: 90,
    defaultGoalMs: 16 * H,
    payTracking: false,
    ...over,
  };
}

function finiteDeep(value: unknown, path = "$"): string[] {
  if (typeof value === "number") return Number.isFinite(value) ? [] : [path];
  if (Array.isArray(value)) return value.flatMap((v, i) => finiteDeep(v, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => finiteDeep(v, `${path}.${k}`));
  return [];
}

describe("insights view model", () => {
  it("empty data: zeros everywhere, no NaN or Infinity, nothing to drill into", () => {
    for (const kind of ["today", "week", "month", "year", "custom"] as const) {
      const range = kind === "custom" ? { from: "2026-01-01", to: "2026-12-31" } : rangeFor(kind, "2026-10-28", 1);
      const m = buildInsights(input([], { kind, range }));
      expect(finiteDeep(m)).toEqual([]);
      expect(m.summary.netMs).toBe(0);
      expect(m.hasAnyData).toBe(false);
      expect(m.ribbon.rows).toEqual([]);
      expect(m.records.longest).toBeNull();
      expect(m.records.bestDay).toBeNull();
      expect(m.clockIn.typicalMinute).toBeNull();
      expect(m.heat.rows.length).toBeGreaterThan(0);
      expect(m.ring.data.every((d) => d.netMs === 0)).toBe(true);
    }
  });

  it("both modes reconcile: over a range holding every session the rendered totals are identical", () => {
    const { state } = history();
    const facts = sessionFacts(visibleSessions(state), 0);
    const totalNet = facts.reduce((s, f) => s + f.metrics.netMs, 0);
    const range = { from: "2026-10-01", to: "2027-01-31" };
    const totals = (["calendar", "start"] as AllocationMode[]).map((mode) => {
      const m = buildInsights(input(facts, { kind: "custom", range, mode, today: "2027-01-31" }));
      expect(m.ring.data.reduce((s, d) => s + d.netMs, 0)).toBe(m.summary.netMs);
      expect(m.bars.totalMs).toBe(m.summary.netMs);
      expect(m.records.netMs).toBe(m.summary.netMs);
      expect(m.otherMode.netMs).toBe(m.summary.netMs);
      return m.summary.netMs;
    });
    expect(totals).toEqual([totalNet, totalNet]);
  });

  it("at a range edge the modes differ and the other-mode total explains it", () => {
    const { state } = history();
    const facts = sessionFacts(visibleSessions(state), 0);
    const range = { from: "2026-10-26", to: "2026-10-26" };
    const cal = buildInsights(input(facts, { kind: "today", range, today: "2026-10-26" }));
    expect(cal.summary.netMs).toBe(6 * H);
    expect(cal.otherMode).toEqual({ mode: "start", netMs: 15.5 * H });
    const start = buildInsights(input(facts, { kind: "today", range, today: "2026-10-26", mode: "start" }));
    expect(start.summary.netMs).toBe(15.5 * H);
  });

  it("month and year ranges split crossing sessions in the bars", () => {
    const { state } = history();
    const facts = sessionFacts(visibleSessions(state), 0);
    const oct = buildInsights(input(facts, { kind: "month", range: rangeFor("month", "2026-10-15", 1), today: "2026-11-20" }));
    expect(oct.bars.unit).toBe("week");
    expect(oct.bars.totalMs).toBe((15.5 + 2) * H);
    expect(oct.summary.netMs).toBe((15.5 + 2) * H);
    const y2027 = buildInsights(input(facts, { kind: "year", range: rangeFor("year", "2027-03-01", 1), today: "2027-03-01" }));
    expect(y2027.summary.netMs).toBe(3 * H);
    expect(y2027.bars.data[0].from).toBe("2027-01-01"); // week bucket clipped to the year
    expect(y2027.ring.form).toBe("spokes");
    expect(y2027.ring.data).toHaveLength(365);
  });

  it("week: concentric rings, today marked, ribbon rows split at midnight with alternating days", () => {
    const { state, first } = history();
    const facts = sessionFacts(visibleSessions(state), 0);
    const m = buildInsights(input(facts));
    expect(m.ring.form).toBe("rings");
    expect(m.ring.data).toHaveLength(7);
    expect(m.ring.data.find((d) => d.isToday)?.key).toBe("2026-10-28");
    expect(m.ring.scaleMs).toBe(16 * H); // a full ring is the goal
    const row = m.ribbon.rows.find((r) => r.sessionId === first)!;
    expect(row.startH).toBe(18);
    expect(row.endH).toBe(34);
    expect(row.segments.map((s) => [s.fromH, s.toH, s.dayIndex])).toEqual([
      [18, 24, 0],
      [24, 26, 1],
      [26.5, 34, 1],
    ]);
    expect(row.breaks).toEqual([{ fromH: 26, toH: 26.5 }]);
    expect(m.ribbon.axis.ticks.some((t) => t.midnight && t.h === 24)).toBe(true);
    expect(m.ribbon.axis.fromH).toBeLessThanOrEqual(18);
    expect(m.ribbon.axis.toH).toBeGreaterThanOrEqual(34);
  });

  it("calendar: Tuesday is marked as coming from Monday's session in calendar mode only", () => {
    const { state, first } = history();
    const facts = sessionFacts(visibleSessions(state), 0);
    const cal = buildInsights(input(facts));
    const tue = cal.calendar.weeks.flat().find((c) => c.date === "2026-10-27")!;
    expect(tue.startedEarlier).toBe(true);
    expect(tue.contributions).toEqual([expect.objectContaining({ sessionId: first, anchor: "2026-10-26", netMs: 9.5 * H })]);
    expect(cal.calendar.month).toBe("2026-10");
    expect(cal.calendar.weeks.every((w) => w.length === 7)).toBe(true);
    expect(cal.calendar.weeks[0][0].date).toBe("2026-09-28"); // Monday start
    const start = buildInsights(input(facts, { mode: "start" }));
    const tue2 = start.calendar.weeks.flat().find((c) => c.date === "2026-10-27")!;
    expect(tue2.startedEarlier).toBe(false);
    expect(tue2.netMs).toBe(0);
    expect(start.calendar.weeks.flat().find((c) => c.date === "2026-10-26")!.netMs).toBe(15.5 * H);
  });

  it("heatmap rows follow the week start and keep 7 columns", () => {
    const { state } = history();
    const facts = sessionFacts(visibleSessions(state), 0);
    for (const weekStart of [0, 1] as const) {
      const m = buildInsights(input(facts, { weekStart, heatDays: 30, today: "2026-11-02", range: rangeFor("week", "2026-11-02", weekStart) }));
      expect(m.heat.weekdays[0]).toBe(weekStart);
      expect(m.heat.rows.every((r) => r.slots.length === 7)).toBe(true);
      const inside = m.heat.rows.flatMap((r) => r.slots).filter((s) => !s.outside);
      expect(inside).toHaveLength(30);
      expect(inside.at(-1)!.date).toBe("2026-11-02");
      expect(m.heat.rows.some((r) => r.monthLabel === "Nov")).toBe(true);
    }
  });

  it("records, clock-in, places and earnings", () => {
    const { state, first } = history();
    const facts = sessionFacts(visibleSessions(state), 0);
    const range = { from: "2026-10-01", to: "2026-12-31" };
    const m = buildInsights(input(facts, { kind: "custom", range, today: "2026-12-31", payTracking: false }));
    expect(m.records.longest).toMatchObject({ sessionId: first, netMs: 15.5 * H });
    expect(m.records.bestDay).toMatchObject({ date: "2026-10-27", netMs: 9.5 * H });
    expect(m.records.crossMidnight).toHaveLength(4);
    expect(m.clockIn.total).toBe(4);
    expect(m.clockIn.hours[23].count).toBe(2);
    expect(m.places.rows[0]).toMatchObject({ kind: "place", label: "Office", netMs: 15.5 * H });
    expect(m.places.rows.map((p) => p.kind).sort()).toEqual(["not_captured", "place", "unlabelled"]);
    expect(m.places.rows.reduce((s, p) => s + p.share, 0)).toBeCloseTo(1);
    expect(m.earnings.show).toBe(true); // one session has a rate
    expect(m.earnings.rows[0].currency).toBe("TZS");
  });

  it("month-on-month compares the same span and keeps the session ids", () => {
    const { state } = history();
    const facts = sessionFacts(visibleSessions(state), 0);
    const m = buildInsights(input(facts, { today: "2026-11-02", range: rangeFor("week", "2026-11-02", 1) }));
    expect(m.comparison.current).toMatchObject({ from: "2026-11-01", to: "2026-11-02", netMs: 10 * H });
    expect(m.comparison.previous).toMatchObject({ from: "2026-10-01", to: "2026-10-02", netMs: 0, sessionIds: [] });
    expect(m.comparison.current.sessionIds).toHaveLength(2);
  });

  it("a running session is included up to now", () => {
    const { state } = shift(EMPTY_STATE, "2026-10-28T08:00", null);
    const facts = sessionFacts(visibleSessions(state), at("2026-10-28T11:30"));
    const m = buildInsights(input(facts, { kind: "today", range: { from: "2026-10-28", to: "2026-10-28" } }));
    expect(m.summary.netMs).toBe(3.5 * H);
    expect(m.ribbon.rows[0].running).toBe(true);
    expect(m.durations.count).toBe(0);
    expect(m.bars.range).toEqual({ from: "2026-10-22", to: "2026-10-28" });
    expect(m.bars.matchesRange).toBe(false);
  });

  it("session breakdown days add up to the session", () => {
    const { state, first } = history();
    const facts = sessionFacts(visibleSessions(state), 0);
    const b = buildSessionBreakdown(facts.find((f) => f.session.id === first)!);
    expect(b.totalNetMs).toBe(15.5 * H);
    expect(b.row.days.map((d) => d.date)).toEqual(["2026-10-26", "2026-10-27"]);
  });
});

describe("chart geometry", () => {
  it("hour scale is finite and covers the value", () => {
    expect(hourScale(0)).toEqual({ maxMs: 0.25 * H, stepMs: 0.25 * H, ticks: [0, 0.25 * H] });
    expect(hourScale(Number.NaN).maxMs).toBeGreaterThan(0);
    const s = hourScale(15.5 * H);
    expect(s.maxMs).toBeGreaterThanOrEqual(15.5 * H);
    expect(s.ticks.length - 1).toBeLessThanOrEqual(4);
    expect(hourScale(92 * H).stepMs).toBe(24 * H);
    expect(hourScale(130 * H).stepMs).toBe(40 * H);
    expect(linear(0, 0, 10, 20)(5)).toBe(10);
    expect(labelEvery(31, 10, 28)).toBe(3);
  });

  it("rings and spokes stay inside the box and map pointers back", () => {
    const tracks = ringTracks(7, 280);
    expect(tracks).toHaveLength(7);
    expect(tracks.every((t) => t.r - t.stroke / 2 > 280 * HOLE && t.r + t.stroke / 2 <= 140)).toBe(true);
    expect(ringOffset(tracks[0], 0, 0)).toBe(tracks[0].circumference);
    expect(ringOffset(tracks[0], 20, 10)).toBe(0);
    const layout = spokeLayout([0, H, 2 * H, 4 * H], 4 * H, 200);
    expect(layout.spokes[0].length).toBe(0);
    expect(layout.spokes[3].length).toBeCloseTo(layout.r1 - layout.r0);
    expect(spokeAt(100, 2, 200, 4)).toBe(0); // straight up = first spoke
    expect(spokeAt(198, 100, 200, 4)).toBe(1);
    expect(spokeAt(100, 100, 200, 4)).toBeNull(); // the hole
  });

  it("heat levels and typical start", () => {
    expect(levelOf(0, 0)).toBe(0);
    expect(levelOf(5, 0)).toBe(0);
    expect(levelOf(1, 100)).toBe(1);
    expect(levelOf(100, 100)).toBe(4);
    expect(typicalStart([])).toEqual({ minute: null, spread: false });
    expect(typicalStart([23 * 60, 60]).minute).toBe(0); // circular: midnight, not noon
    expect(typicalStart([18 * 60, 18 * 60 + 10, 17 * 60 + 50]).minute).toBe(18 * 60);
    expect(typicalStart([0, 360, 720, 1080])).toEqual({ minute: null, spread: true });
    // Two habits: mostly evenings, some mornings → the evening habit, not a time in between.
    expect(typicalStart([17 * 60, 17 * 60 + 30, 18 * 60, 18 * 60 + 30, 7 * 60, 7 * 60 + 15]).minute).toBe(17 * 60 + 45);
  });
});

describe("recap card", () => {
  const colors = { background: "#000", card: "#111", foreground: "#fff", muted: "#999", brand: "#88f", brandSoft: "#334", track: "#222", border: "#333" };
  const base: RecapInput = {
    eyebrow: "Week of 19–25 Oct",
    title: "19–25 Oct 2026",
    netMs: 92 * H,
    breakMs: 3 * H,
    sessions: 6,
    daysWorked: 6,
    modeLabel: "Allocated to calendar days",
    bars: [{ label: "Mon", netMs: 15 * H, breakMs: H }],
    referenceMs: 16 * H,
    colors,
  };

  it("never carries place names unless included, and escapes text", () => {
    const plain = recapSvg(base);
    expect(plain).not.toContain("PLACES");
    expect(plain).toContain("92h");
    const withPlaces = recapSvg({ ...base, places: [{ label: "Office <A&B>", netMs: 10 * H }] });
    expect(withPlaces).toContain("Office &lt;A&amp;B&gt;");
    expect(withPlaces).not.toMatch(/-6\.79|39\.20/);
  });
});
