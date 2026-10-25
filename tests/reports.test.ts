import { describe, expect, it } from "vitest";

import {
  buckets,
  clockInHours,
  contributionsOn,
  dailyTotals,
  durationStats,
  earnings,
  heatmap,
  monthComparison,
  placeBreakdown,
  rangeFor,
  records,
  sessionFacts,
  shiftRange,
  summarize,
} from "@/lib/reports";
import { breakEndEvent, breakStartEvent, clockInEvent, clockOutEvent, manualCreateEvent, simpleEvent, type EventContext } from "@/lib/shifts/events";
import { applyEvent } from "@/lib/shifts/reducer";
import { EMPTY_STATE, visibleSessions, type ShiftEvent, type ShiftState } from "@/lib/shifts/types";
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

function shift(state: ShiftState, from: string, to: string, opts: { brk?: [string, string]; rate?: number } = {}) {
  const inn = clockInEvent(ctx(from), { goalSeconds: 16 * 3600, reportingTimeZone: DAR, payRateMinor: opts.rate ?? null, currency: opts.rate ? "TZS" : null });
  state = apply(state, inn);
  if (opts.brk) {
    const b = breakStartEvent(ctx(opts.brk[0]), inn.sessionId);
    state = apply(state, b);
    state = apply(state, breakEndEvent(ctx(opts.brk[1]), inn.sessionId, b.breakId));
  }
  return { state: apply(state, clockOutEvent(ctx(to), inn.sessionId)), id: inn.sessionId };
}

function history() {
  let s = EMPTY_STATE;
  const a = shift(s, "2026-10-26T18:00", "2026-10-27T10:00", { brk: ["2026-10-27T02:00", "2026-10-27T02:30"], rate: 5000 });
  s = a.state;
  s = shift(s, "2026-10-31T22:00", "2026-11-01T06:00").state; // Sat → Sun, crosses month
  s = shift(s, "2026-11-01T23:00", "2026-11-02T03:00").state; // Sun → Mon, crosses week
  s = shift(s, "2026-12-31T23:00", "2027-01-01T03:00").state; // crosses year
  return { state: s, first: a.id };
}

describe("reconciliation", () => {
  it("calendar and start modes both count every millisecond exactly once", () => {
    const { state } = history();
    const facts = sessionFacts(visibleSessions(state), 0);
    const totalNet = facts.reduce((s, f) => s + f.metrics.netMs, 0);
    for (const mode of ["calendar", "start"] as const) {
      const daily = dailyTotals(facts, mode);
      expect([...daily.values()].reduce((s, d) => s + d.netMs, 0)).toBe(totalNet);
      const all = summarize(daily, { from: "2026-10-01", to: "2027-01-31" }, mode);
      expect(all.netMs).toBe(totalNet);
    }
  });

  it("acceptance: Monday holds 6h and Tuesday 9h30 in calendar mode; start mode puts 15h30 on Monday", () => {
    const { state, first } = history();
    const facts = sessionFacts(visibleSessions(state), 0);
    const cal = dailyTotals(facts, "calendar");
    expect(cal.get("2026-10-26")!.netMs).toBe(6 * H);
    expect(cal.get("2026-10-27")!.netMs).toBe(9.5 * H);
    const start = dailyTotals(facts, "start");
    expect(start.get("2026-10-26")!.netMs).toBe(15.5 * H);
    expect(start.get("2026-10-27")).toBeUndefined();
    // The Tuesday cell links back to Monday's session.
    expect(contributionsOn(facts, "2026-10-27")).toEqual([{ sessionId: first, netMs: 9.5 * H, breakMs: 0.5 * H, startedEarlier: true, anchor: "2026-10-26" }]);
  });

  it("week, month and year buckets split cross-boundary sessions exactly", () => {
    const { state } = history();
    const facts = sessionFacts(visibleSessions(state), 0);
    const daily = dailyTotals(facts, "calendar");
    const weeks = buckets(daily, facts, { from: "2026-10-26", to: "2026-11-08" }, "week", 1);
    expect(weeks.map((w) => [w.key, w.netMs / H])).toEqual([
      ["2026-10-26", 15.5 + 8 + 1],
      ["2026-11-02", 3],
    ]);
    const months = buckets(daily, facts, { from: "2026-10-01", to: "2027-01-31" }, "month", 1);
    expect(months.map((m) => [m.key, m.netMs / H])).toEqual([
      ["2026-10", 15.5 + 2],
      ["2026-11", 6 + 4],
      ["2026-12", 1],
      ["2027-01", 3],
    ]);
    expect(summarize(daily, rangeFor("year", "2026-06-01", 1), "calendar").netMs).toBe((15.5 + 2 + 10 + 1) * H);
    expect(summarize(daily, rangeFor("year", "2027-06-01", 1), "calendar").netMs).toBe(3 * H);
  });

  it("trash is excluded everywhere", () => {
    const { state, first } = history();
    const trashed = apply(state, simpleEvent(ctx("2027-01-02T09:00"), "delete", first));
    const facts = sessionFacts(Object.values(trashed.sessions), 0);
    expect(facts.find((f) => f.session.id === first)).toBeUndefined();
  });
});

describe("widgets", () => {
  it("O: empty history gives zeros, no NaN, no ghost rows", () => {
    const facts = sessionFacts([], 0);
    const daily = dailyTotals(facts, "calendar");
    const sum = summarize(daily, rangeFor("week", "2026-10-28", 1), "calendar");
    expect(sum.netMs).toBe(0);
    expect(sum.series).toHaveLength(7);
    expect(durationStats(facts)).toMatchObject({ meanMs: 0, medianMs: 0, count: 0 });
    expect(records(facts)).toMatchObject({ totalSessions: 0, longest: null, bestDay: null, goalRatio: null });
    expect(monthComparison(daily, "2026-10-28").deltaRatio).toBeNull();
    expect(heatmap(daily, "2026-10-28", 30).every((c) => c.level === 0)).toBe(true);
  });

  it("running sessions are allocated up to now", () => {
    const s = apply(EMPTY_STATE, clockInEvent(ctx("2026-10-26T22:00"), { goalSeconds: 57600, reportingTimeZone: DAR }));
    const facts = sessionFacts(visibleSessions(s), at("2026-10-27T01:00"));
    const daily = dailyTotals(facts, "calendar");
    expect(daily.get("2026-10-26")!.netMs).toBe(2 * H);
    expect(daily.get("2026-10-27")!.netMs).toBe(1 * H);
    expect(durationStats(facts).count).toBe(0); // running sessions aren't a finished duration
  });

  it("distribution, records, heatmap, month comparison", () => {
    const { state, first } = history();
    const facts = sessionFacts(visibleSessions(state), 0);
    const hours = clockInHours(facts);
    expect(hours[18]).toBe(1);
    expect(hours[22]).toBe(1);
    expect(hours[23]).toBe(2);
    const d = durationStats(facts);
    expect(d.count).toBe(4);
    expect(d.medianMs).toBe(6 * H); // 4, 4, 8, 15.5
    expect(d.histogram[2].count).toBe(2); // 4–6h
    const r = records(facts);
    expect(r.longest).toEqual({ sessionId: first, netMs: 15.5 * H });
    expect(r.bestDay).toEqual({ date: "2026-10-27", netMs: 9.5 * H });
    expect(r.crossMidnightCount).toBe(4);
    expect(r.goalRatio).toBe(0);
    const daily = dailyTotals(facts, "calendar");
    const m = monthComparison(daily, "2026-11-02");
    expect(m.current.netMs).toBe(10 * H); // Nov 1–2
    expect(m.previous.netMs).toBe(0); // Oct 1–2
    const cells = heatmap(daily, "2026-11-02", 7);
    expect(cells.find((c) => c.date === "2026-10-27")!.level).toBe(4);
  });

  it("earnings follow the mode and round once", () => {
    const { state } = history();
    const facts = sessionFacts(visibleSessions(state), 0);
    // 5,000 TZS/h. Calendar: Monday only gets 6h.
    expect(earnings(facts, { from: "2026-10-26", to: "2026-10-26" }, "calendar")).toEqual([{ currency: "TZS", amountMinor: 30_000, netMs: 6 * H }]);
    expect(earnings(facts, { from: "2026-10-26", to: "2026-10-26" }, "start")).toEqual([{ currency: "TZS", amountMinor: 77_500, netMs: 15.5 * H }]);
  });

  it("place breakdown never needs coordinates and says when nothing was captured", () => {
    const { state } = history();
    const facts = sessionFacts(visibleSessions(state), 0);
    expect(placeBreakdown(facts)).toEqual([expect.objectContaining({ kind: "not_captured", sessionIds: expect.any(Array) })]);
  });

  it("manual sessions count like any other", () => {
    const s = apply(
      EMPTY_STATE,
      manualCreateEvent(ctx("2026-10-28T12:00"), { startedAt: at("2026-10-27T08:00"), endedAt: at("2026-10-27T12:00"), breaks: [], goalSeconds: 57600, reportingTimeZone: DAR }),
    );
    expect(dailyTotals(sessionFacts(visibleSessions(s), 0), "calendar").get("2026-10-27")!.netMs).toBe(4 * H);
  });

  it("rangeFor and shiftRange", () => {
    expect(rangeFor("week", "2026-11-01", 1)).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(rangeFor("week", "2026-11-01", 0)).toEqual({ from: "2026-11-01", to: "2026-11-07" });
    expect(rangeFor("month", "2026-02-10", 1)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(shiftRange(rangeFor("month", "2026-01-15", 1), "month", 1)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(shiftRange({ from: "2026-10-26", to: "2026-11-01" }, "week", -1)).toEqual({ from: "2026-10-19", to: "2026-10-25" });
  });
});
