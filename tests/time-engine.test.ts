import { describe, expect, it } from "vitest";

import { allocateByDay, anchorDate, goalProgress, sessionMetrics, type TimedSession } from "@/lib/time/allocate";
import { subtract, union } from "@/lib/time/intervals";
import {
  addDays,
  fromWallClockInput,
  localDateOf,
  nextDayBoundary,
  offsetMs,
  startOfLocalDay,
  startOfWeek,
  wallClock,
} from "@/lib/time/zone";

const H = 3_600_000;
const M = 60_000;
const DAR = "Africa/Dar_es_Salaam";

function at(value: string, zone = DAR): number {
  const instant = fromWallClockInput(value, zone);
  if (instant === null) throw new Error(`bad time ${value}`);
  return instant;
}

function session(start: string, end: string | null, breaks: [string, string | null][] = [], zone = DAR): TimedSession {
  return {
    startedAt: at(start, zone),
    endedAt: end === null ? null : at(end, zone),
    breaks: breaks.map(([s, e]) => ({ startedAt: at(s, zone), endedAt: e === null ? null : at(e, zone) })),
    reportingTimeZone: zone,
  };
}

function days(s: TimedSession, now = 0) {
  return Object.fromEntries(allocateByDay(s, now).map((d) => [d.date, d.netMs / M]));
}

function expectInvariants(s: TimedSession, now = 0) {
  const metrics = sessionMetrics(s, now);
  const allocation = allocateByDay(s, now);
  expect(allocation.reduce((sum, d) => sum + d.netMs, 0)).toBe(metrics.netMs);
  expect(allocation.reduce((sum, d) => sum + d.elapsedMs, 0)).toBe(metrics.elapsedMs);
  expect(allocation.reduce((sum, d) => sum + d.breakMs, 0)).toBe(metrics.breakMs);
  for (const d of allocation) {
    expect(d.netMs).toBeGreaterThanOrEqual(0);
    expect(d.breakMs).toBeGreaterThanOrEqual(0);
    expect(d.elapsedMs).toBeGreaterThan(0);
  }
  expect(metrics.netMs).toBeGreaterThanOrEqual(0);
}

describe("fixtures A–E (TRD §3.6)", () => {
  it("A: Monday 18:00 → Tuesday 10:00 is one 16h session, 6h Monday + 10h Tuesday, anchored Monday", () => {
    const s = session("2026-10-26T18:00", "2026-10-27T10:00");
    const m = sessionMetrics(s, 0);
    expect(m.netMs).toBe(16 * H);
    expect(m.elapsedMs).toBe(16 * H);
    expect(days(s)).toEqual({ "2026-10-26": 360, "2026-10-27": 600 });
    expect(anchorDate(s)).toBe("2026-10-26");
    expectInvariants(s);
  });

  it("B: same with a Tuesday 02:00–02:30 break: 15h30 net, 6h Monday + 9h30 Tuesday", () => {
    const s = session("2026-10-26T18:00", "2026-10-27T10:00", [["2026-10-27T02:00", "2026-10-27T02:30"]]);
    const m = sessionMetrics(s, 0);
    expect(m.elapsedMs).toBe(16 * H);
    expect(m.breakMs).toBe(30 * M);
    expect(m.netMs).toBe(15.5 * H);
    expect(days(s)).toEqual({ "2026-10-26": 360, "2026-10-27": 570 });
    expectInvariants(s);
  });

  it("C: Friday 22:00 → Saturday 06:00 with a Saturday 00:30–01:00 break: Fri 2h, Sat 5h30", () => {
    const s = session("2026-10-30T22:00", "2026-10-31T06:00", [["2026-10-31T00:30", "2026-10-31T01:00"]]);
    expect(days(s)).toEqual({ "2026-10-30": 120, "2026-10-31": 330 });
    expectInvariants(s);
  });

  it("D: Dec 31 23:00 → Jan 1 03:00 is one session across two years: 1h + 3h", () => {
    const s = session("2026-12-31T23:00", "2027-01-01T03:00");
    expect(days(s)).toEqual({ "2026-12-31": 60, "2027-01-01": 180 });
    expectInvariants(s);
  });

  it("E: Sunday 23:00 → Monday 03:00 lands in two Monday-first weeks", () => {
    const s = session("2026-11-01T23:00", "2026-11-02T03:00");
    const allocation = allocateByDay(s, 0);
    const weeks = new Map<string, number>();
    for (const d of allocation) {
      const week = startOfWeek(d.date, 1);
      weeks.set(week, (weeks.get(week) ?? 0) + d.netMs);
    }
    expect(Object.fromEntries(weeks)).toEqual({ "2026-10-26": 1 * H, "2026-11-02": 3 * H });
    // Sunday-first weeks keep it together.
    expect(new Set(allocation.map((d) => startOfWeek(d.date, 0))).size).toBe(1);
  });

  it("a session crossing a month boundary splits into both months, no ghost rows", () => {
    const s = session("2026-10-31T20:00", "2026-11-01T02:00");
    expect(days(s)).toEqual({ "2026-10-31": 240, "2026-11-01": 120 });
  });

  it("a session spanning several midnights keeps one interval and allocates every day", () => {
    const s = session("2026-10-26T22:00", "2026-10-29T01:00", [["2026-10-27T23:30", "2026-10-28T00:30"]]);
    expect(days(s)).toEqual({ "2026-10-26": 120, "2026-10-27": 1410, "2026-10-28": 1410, "2026-10-29": 60 });
    expectInvariants(s);
  });
});

describe("F: daylight saving time", () => {
  const NY = "America/New_York";
  it("spring forward: a 23-hour local day; 20:00 → 08:00 is 11h of real time", () => {
    // 2026-03-08 02:00 EST jumps to 03:00 EDT.
    const s = session("2026-03-07T20:00", "2026-03-08T08:00", [], NY);
    expect(sessionMetrics(s, 0).netMs).toBe(11 * H);
    expect(days(s)).toEqual({ "2026-03-07": 240, "2026-03-08": 420 });
    expect(startOfLocalDay("2026-03-09", NY) - startOfLocalDay("2026-03-08", NY)).toBe(23 * H);
    expectInvariants(s);
  });

  it("fall back: a 25-hour local day; 20:00 → 08:00 is 13h of real time", () => {
    // 2026-11-01 02:00 EDT falls back to 01:00 EST.
    const s = session("2026-10-31T20:00", "2026-11-01T08:00", [], NY);
    expect(sessionMetrics(s, 0).netMs).toBe(13 * H);
    expect(days(s)).toEqual({ "2026-10-31": 240, "2026-11-01": 540 });
    expect(startOfLocalDay("2026-11-02", NY) - startOfLocalDay("2026-11-01", NY)).toBe(25 * H);
    expectInvariants(s);
  });

  it("a whole 25h local day of work is allocated as 25h to that date", () => {
    const s = session("2026-11-01T00:00", "2026-11-02T00:00", [], NY);
    expect(days(s)).toEqual({ "2026-11-01": 25 * 60 });
  });

  it("repeated hour: the earlier instant is taken for an ambiguous wall time", () => {
    const first = at("2026-11-01T01:30", NY);
    expect(offsetMs(first, NY)).toBe(-4 * H); // still EDT
    expect(offsetMs(first + H, NY)).toBe(-5 * H); // same wall time again, EST
    expect(wallClock(first + H, NY).hour).toBe(1);
  });

  it("skipped hour: a wall time inside the gap moves forward like a clock", () => {
    const t = at("2026-03-08T02:30", NY);
    expect(wallClock(t, NY).hour).toBe(3);
    expect(wallClock(t, NY).minute).toBe(30);
  });

  it("Europe/London: the October change still splits at real midnight", () => {
    const LON = "Europe/London";
    const s = session("2026-10-24T22:00", "2026-10-25T06:00", [["2026-10-25T03:00", "2026-10-25T03:30"]], LON);
    // 2026-10-25 02:00 BST → 01:00 GMT: 22:00 → 06:00 local is 9 real hours.
    const m = sessionMetrics(s, 0);
    expect(m.elapsedMs).toBe(9 * H);
    expect(m.breakMs).toBe(30 * M);
    expect(days(s)).toEqual({ "2026-10-24": 120, "2026-10-25": 390 });
    expectInvariants(s);
  });

  it("a zone that skips midnight (America/Santiago, Sept): the day starts at 01:00", () => {
    const SCL = "America/Santiago";
    const start = startOfLocalDay("2026-09-06", SCL);
    expect(wallClock(start, SCL).hour).toBe(1);
    expect(localDateOf(start - 1, SCL)).toBe("2026-09-05");
    const s = session("2026-09-05T22:00", "2026-09-06T03:00", [], SCL);
    expect(sessionMetrics(s, 0).netMs).toBe(4 * H);
    expect(days(s)).toEqual({ "2026-09-05": 120, "2026-09-06": 120 });
  });

  it("a zone that falls back across midnight (America/Santiago, April) keeps the sums exact", () => {
    const SCL = "America/Santiago";
    const startedAt = Date.UTC(2026, 3, 5, 1, 0); // 2026-04-04 22:00 -03
    const s: TimedSession = { startedAt, endedAt: startedAt + 6 * H, breaks: [], reportingTimeZone: SCL };
    expectInvariants(s);
    const allocation = allocateByDay(s, 0);
    expect(allocation.reduce((sum, d) => sum + d.netMs, 0)).toBe(6 * H);
    expect(allocation.map((d) => d.date)).toEqual(["2026-04-04", "2026-04-05"]);
  });
});

describe("boundaries in many zones", () => {
  const zones = [DAR, "UTC", "America/New_York", "Europe/London", "Asia/Kolkata", "Australia/Lord_Howe", "Pacific/Chatham", "America/Santiago", "Asia/Kathmandu", "Pacific/Kiritimati", "Pacific/Pago_Pago"];
  it("nextDayBoundary is the exact instant the local date changes", () => {
    for (const zone of zones) {
      let t = Date.UTC(2026, 0, 1, 7, 13);
      for (let i = 0; i < 400; i++) {
        const b = nextDayBoundary(t, zone);
        expect(b).toBeGreaterThan(t);
        expect(localDateOf(b, zone)).not.toBe(localDateOf(b - 1000, zone));
        t = b + ((i * 7919) % 86_000) * 1000;
      }
    }
  });

  it("random sessions keep Σ allocations === totals in every zone", () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let i = 0; i < 300; i++) {
      const zone = zones[i % zones.length];
      const startedAt = Date.UTC(2026, 0, 1) + Math.floor(rand() * 365 * 24 * H);
      const length = Math.floor(rand() * 40 * H);
      const breaks = Array.from({ length: Math.floor(rand() * 4) }, () => {
        const s = startedAt + Math.floor(rand() * length);
        return { startedAt: s, endedAt: s + Math.floor(rand() * 2 * H) };
      });
      expectInvariants({ startedAt, endedAt: startedAt + length, breaks, reportingTimeZone: zone });
    }
  });
});

describe("breaks and running sessions", () => {
  it("K: overlapping and out-of-session breaks are clipped and merged, never subtracted twice", () => {
    const s = session("2026-10-26T09:00", "2026-10-26T17:00", [
      ["2026-10-26T08:00", "2026-10-26T09:30"],
      ["2026-10-26T12:00", "2026-10-26T13:00"],
      ["2026-10-26T12:30", "2026-10-26T13:30"],
      ["2026-10-26T16:45", "2026-10-26T18:00"],
    ]);
    const m = sessionMetrics(s, 0);
    expect(m.breakMs).toBe(30 * M + 90 * M + 15 * M);
    expect(m.netMs).toBe(8 * H - m.breakMs);
    expectInvariants(s);
  });

  it("K: clock out during a break closes it at the session end", () => {
    const s = session("2026-10-26T09:00", "2026-10-26T17:00", [["2026-10-26T16:00", null]]);
    expect(sessionMetrics(s, 0).breakMs).toBe(H);
    expect(sessionMetrics(s, 0).netMs).toBe(7 * H);
  });

  it("H: a running session is computed from timestamps at any `now`, however long the app slept", () => {
    const s = session("2026-10-26T18:00", null, [["2026-10-26T20:00", "2026-10-26T20:15"]]);
    const now = at("2026-10-27T01:00");
    const m = sessionMetrics(s, now);
    expect(m.running).toBe(true);
    expect(m.elapsedMs).toBe(7 * H);
    expect(m.netMs).toBe(7 * H - 15 * M);
    expect(days(s, now)).toEqual({ "2026-10-26": 345, "2026-10-27": 60 });
  });

  it("an open break on a running session counts up to now", () => {
    const s = session("2026-10-26T18:00", null, [["2026-10-26T20:00", null]]);
    expect(sessionMetrics(s, at("2026-10-26T21:00")).breakMs).toBe(H);
  });

  it("L: a device clock behind the start shows zero and is flagged, never negative", () => {
    const s = session("2026-10-26T18:00", null);
    const m = sessionMetrics(s, at("2026-10-26T17:58"));
    expect(m.elapsedMs).toBe(0);
    expect(m.netMs).toBe(0);
    expect(m.clockBehind).toBe(true);
    expect(allocateByDay(s, at("2026-10-26T17:58"))).toEqual([]);
  });

  it("O: a zero-length session has no allocation rows and no NaN", () => {
    const s = session("2026-10-26T18:00", "2026-10-26T18:00");
    expect(allocateByDay(s, 0)).toEqual([]);
    expect(sessionMetrics(s, 0).netMs).toBe(0);
  });
});

describe("N: goal progress", () => {
  it("caps the ring at 100% and reports overage separately", () => {
    const g = goalProgress(17 * H, 16 * 3600, 0, true);
    expect(g.ratio).toBe(1);
    expect(g.overageMs).toBe(H);
    expect(g.remainingMs).toBe(0);
    expect(g.predictedFinishAt).toBeNull();
  });

  it("predicts the finish from net time while working, not on a break", () => {
    expect(goalProgress(10 * H, 16 * 3600, 1000, true).predictedFinishAt).toBe(1000 + 6 * H);
    expect(goalProgress(10 * H, 16 * 3600, 1000, false).predictedFinishAt).toBeNull();
    expect(goalProgress(4 * H, 16 * 3600, 0, true).ratio).toBe(0.25);
  });
});

describe("interval helpers", () => {
  it("union merges overlapping and touching intervals", () => {
    expect(union([{ start: 5, end: 7 }, { start: 1, end: 3 }, { start: 3, end: 4 }, { start: 6, end: 9 }])).toEqual([
      { start: 1, end: 4 },
      { start: 5, end: 9 },
    ]);
  });

  it("subtract leaves the gaps", () => {
    expect(subtract({ start: 0, end: 10 }, [{ start: 2, end: 3 }, { start: 2.5, end: 4 }, { start: 9, end: 12 }])).toEqual([
      { start: 0, end: 2 },
      { start: 4, end: 9 },
    ]);
  });

  it("addDays and startOfWeek are pure calendar math", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(startOfWeek("2026-11-01", 1)).toBe("2026-10-26");
    expect(startOfWeek("2026-11-01", 0)).toBe("2026-11-01");
  });
});
