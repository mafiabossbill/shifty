import { describe, expect, it } from "vitest";

import { rhythm } from "@/lib/rewards";
import { addDays, eachDate, weekdayOf } from "@/lib/time/zone";

const WEEKDAYS = [1, 2, 3, 4, 5];
// 2026-10-26 is a Monday.
const dates = (...list: string[]) => new Set(list);
const range = (from: string, to: string, planned = WEEKDAYS) => new Set(eachDate(from, to).filter((d) => planned.includes(weekdayOf(d))));

describe("forgiving rhythm", () => {
  it("is empty and pending with no history", () => {
    expect(rhythm({ workDates: new Set(), plannedWeekdays: WEEKDAYS, today: "2026-10-27" })).toEqual({
      current: 0,
      best: 0,
      freezesAvailable: 0,
      todayStatus: "pending",
      frozenDates: [],
    });
  });

  it("skips weekends neutrally and never breaks on a pending today", () => {
    const r = rhythm({ workDates: range("2026-10-26", "2026-11-02"), plannedWeekdays: WEEKDAYS, today: "2026-11-03" });
    expect(r).toMatchObject({ current: 6, best: 6, todayStatus: "pending" });
  });

  it("counts today once it is logged, and says rest on an unplanned today", () => {
    const work = range("2026-10-26", "2026-10-28");
    expect(rhythm({ workDates: work, plannedWeekdays: WEEKDAYS, today: "2026-10-28" })).toMatchObject({ current: 3, todayStatus: "logged" });
    expect(rhythm({ workDates: work, plannedWeekdays: WEEKDAYS, today: "2026-11-01" }).todayStatus).toBe("rest");
  });

  it("working on a rest day neither adds nor breaks", () => {
    const work = range("2026-10-26", "2026-11-02");
    work.add("2026-10-31");
    expect(rhythm({ workDates: work, plannedWeekdays: WEEKDAYS, today: "2026-11-03" }).current).toBe(6);
  });

  it("a missed planned day without a freeze starts a new rhythm; best is kept, nothing else is lost", () => {
    const work = dates("2026-10-26", "2026-10-27", "2026-10-28", "2026-10-30");
    expect(rhythm({ workDates: work, plannedWeekdays: WEEKDAYS, today: "2026-11-02" })).toMatchObject({ current: 1, best: 3, freezesAvailable: 0 });
  });

  it("earns a freeze per 7 counted days (max 2) and spends it on a missed planned day", () => {
    const work = range("2026-10-26", "2026-11-03"); // 7 planned days → one freeze
    const r = rhythm({ workDates: work, plannedWeekdays: WEEKDAYS, today: "2026-11-04" });
    expect(r).toMatchObject({ current: 7, freezesAvailable: 1 });
    const after = new Set([...work, "2026-11-05", "2026-11-06"]); // 2026-11-04 missed
    const frozen = rhythm({ workDates: after, plannedWeekdays: WEEKDAYS, today: "2026-11-07" });
    expect(frozen).toMatchObject({ current: 9, best: 9, freezesAvailable: 0, frozenDates: ["2026-11-04"] });

    const long = range("2026-10-26", addDays("2026-10-26", 7 * 6));
    expect(rhythm({ workDates: long, plannedWeekdays: WEEKDAYS, today: addDays("2026-10-26", 7 * 6 + 1) }).freezesAvailable).toBe(2);
  });

  it("honours a freeze already shown to the person even if recomputed history no longer has one", () => {
    const work = dates("2026-10-26", "2026-10-28");
    const r = rhythm({ workDates: work, plannedWeekdays: WEEKDAYS, today: "2026-10-29", freezesUsed: ["2026-10-27"] });
    expect(r).toMatchObject({ current: 2, frozenDates: ["2026-10-27"] });
  });

  it("every day planned or none planned", () => {
    const all = [0, 1, 2, 3, 4, 5, 6];
    expect(rhythm({ workDates: range("2026-10-26", "2026-11-01", all), plannedWeekdays: all, today: "2026-11-02" }).current).toBe(7);
    expect(rhythm({ workDates: range("2026-10-26", "2026-11-01"), plannedWeekdays: [], today: "2026-11-02" })).toMatchObject({ current: 0, todayStatus: "rest" });
  });
});
