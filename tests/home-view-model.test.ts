import { describe, expect, it } from "vitest";

import {
  capturedLocationLine,
  crossedMidnightLine,
  dayWord,
  daySplitLine,
  goalAtLine,
  greetingFor,
  JUST_FINISHED_MS,
  lastCompleted,
  latestFix,
  mochiStatusFor,
  overageLine,
  parseTags,
  rhythmLines,
  splitStopwatch,
  undoSecondsLeft,
  weekBars,
} from "@/lib/home/view-model";
import { formatDuration } from "@/lib/format";
import { allocateByDay } from "@/lib/time/allocate";
import { dailyTotals, rangeFor, sessionFacts, summarize } from "@/lib/reports";
import type { LocationFix, ShiftSession } from "@/lib/shifts/types";

const ZONE = "Africa/Dar_es_Salaam"; // UTC+3, no DST
const H = 3_600_000;
// Mon 26 Oct 2026 18:00 EAT = 15:00 UTC
const MON_18 = Date.UTC(2026, 9, 26, 15, 0, 0);

function session(over: Partial<ShiftSession> = {}): ShiftSession {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    originEventId: "e1",
    originalStartedAt: MON_18,
    startedAt: MON_18,
    endedAt: null,
    origin: "timer",
    reportingTimeZone: ZONE,
    startTimeZone: ZONE,
    endTimeZone: null,
    goalSeconds: 16 * 3600,
    title: "",
    notes: "",
    projectId: null,
    tags: [],
    payRateMinor: null,
    currency: null,
    mood: null,
    energy: null,
    breaks: [],
    locations: [],
    revisions: [],
    flags: [],
    archivedAt: null,
    deletedAt: null,
    revision: 1,
    createdAt: MON_18,
    updatedAt: MON_18,
    ...over,
  };
}

describe("greetingFor", () => {
  it("greets by the hour in the reporting zone, with the name when set", () => {
    expect(greetingFor(19, "Bill")).toBe("Good evening, Bill");
    expect(greetingFor(8, "Bill")).toBe("Good morning, Bill");
    expect(greetingFor(13, "")).toBe("Good afternoon");
    expect(greetingFor(2, "  ")).toBe("Hello, night owl");
    expect(greetingFor(2, "Bill")).toBe("Hello, Bill");
  });
});

describe("mochiStatusFor", () => {
  it("is active / on break while running", () => {
    expect(mochiStatusFor(session(), null, MON_18 + H)).toBe("active");
    expect(
      mochiStatusFor(
        session({
          breaks: [{ id: "b", startedAt: MON_18 + H, endedAt: null, kind: "rest" }],
        }),
        null,
        MON_18 + 2 * H,
      ),
    ).toBe("on_break");
  });
  it("is just_finished for ten minutes after a clock-out, then idle", () => {
    const done = session({ endedAt: MON_18 + 8 * H });
    expect(mochiStatusFor(null, done, MON_18 + 8 * H + 60_000)).toBe("just_finished");
    expect(mochiStatusFor(null, done, MON_18 + 8 * H + JUST_FINISHED_MS)).toBe("idle");
    expect(mochiStatusFor(null, null, MON_18)).toBe("idle");
  });
});

describe("lastCompleted", () => {
  it("skips the running session", () => {
    const running = session({ id: "a", startedAt: MON_18 + 24 * H });
    const done = session({ id: "b", endedAt: MON_18 + 4 * H });
    expect(lastCompleted([running, done])?.id).toBe("b");
    expect(lastCompleted([running])).toBeNull();
  });
});

describe("day words and goal line", () => {
  it("says today / tomorrow / yesterday / weekday", () => {
    expect(dayWord("2026-10-26", "2026-10-26")).toBe("today");
    expect(dayWord("2026-10-27", "2026-10-26")).toBe("tomorrow");
    expect(dayWord("2026-10-25", "2026-10-26")).toBe("yesterday");
    expect(dayWord("2026-10-29", "2026-10-26")).toBe("Thu");
  });
  it("predicts the finish in the session's zone", () => {
    // Tue 10:14 EAT = 07:14 UTC
    expect(goalAtLine(Date.UTC(2026, 9, 27, 7, 14), MON_18 + H, ZONE, "24h")).toBe("Goal at 10:14 tomorrow");
    expect(goalAtLine(Date.UTC(2026, 9, 27, 7, 14), MON_18 + H, ZONE, "12h")).toBe("Goal at 10:14 am tomorrow");
  });
});

describe("crossing midnight (brief acceptance: Mon 18:00 → Tue, break 02:00–02:30)", () => {
  const brk = {
    id: "b",
    startedAt: Date.UTC(2026, 9, 26, 23, 0),
    endedAt: Date.UTC(2026, 9, 26, 23, 30),
    kind: "rest" as const,
  };
  const s = session({ breaks: [brk] });
  const now = Date.UTC(2026, 9, 27, 7, 0); // Tue 10:00 EAT

  it("shows each day's net with 'today' for the current one", () => {
    const days = allocateByDay(s, now);
    expect(crossedMidnightLine(days, "2026-10-27")).toBe("Crossed midnight · 6h on Mon, 9h 30m today");
  });
  it("is null for a single-day session", () => {
    expect(crossedMidnightLine(allocateByDay(s, MON_18 + 2 * H), "2026-10-26")).toBeNull();
  });
  it("recap split reads Mon 6h · Tue 9h 30m", () => {
    expect(daySplitLine(allocateByDay({ ...s, endedAt: now }, now))).toBe("Mon 6h · Tue 9h 30m");
  });
});

describe("per-day splits add up to the net shown (QA-M2: clock-in seconds)", () => {
  // Mon 19 Oct 18:00:30 → Tue 20 Oct 01:12:30 EAT: net 7h 12m, Mon 5h 59m 30s + Tue 1h 12m 30s.
  const start = Date.UTC(2026, 9, 19, 15, 0, 30);
  const end = Date.UTC(2026, 9, 19, 22, 12, 30);
  const s = session({ startedAt: start, originalStartedAt: start });

  it("recap split reads Mon 5h 59m · Tue 1h 13m (sums to 7h 12m, not 7h 11m)", () => {
    const days = allocateByDay({ ...s, endedAt: end }, end);
    expect(formatDuration(days.reduce((t, d) => t + d.netMs, 0))).toBe("7h 12m");
    expect(daySplitLine(days)).toBe("Mon 5h 59m · Tue 1h 13m");
  });
  it("hero midnight line sums to the 07:12 readout, and Mon stays put while today grows", () => {
    for (const [now, tue] of [
      [end, "1h 13m"],
      [end + 1_000, "1h 13m"],
      [end + 29_000, "1h 13m"],
      [end + 31_000, "1h 13m"],
      [end + 60_000, "1h 14m"],
    ] as const) {
      expect(crossedMidnightLine(allocateByDay(s, now), "2026-10-20")).toBe(`Crossed midnight · 5h 59m on Mon, ${tue} today`);
    }
  });
  it("leaves already-exact splits alone", () => {
    const days = allocateByDay({ ...s, startedAt: MON_18, endedAt: MON_18 + 15 * H }, MON_18 + 15 * H);
    expect(daySplitLine(days)).toBe("Mon 6h · Tue 9h");
  });
});

describe("overageLine", () => {
  it("is neutral and only past the goal", () => {
    expect(overageLine(17 * H + 12 * 60_000, 16 * 3600)).toBe("+1h 12m past your goal. Rest well.");
    expect(overageLine(16 * H, 16 * 3600)).toBeNull();
    expect(overageLine(10 * H, 16 * 3600)).toBeNull();
    expect(overageLine(10 * H, 0)).toBeNull();
  });
  it("never uses praise words", () => {
    expect(overageLine(20 * H, 16 * 3600)).not.toMatch(/great|well done|amazing|congrat/i);
  });
});

describe("location lines", () => {
  const fix = (over: Partial<LocationFix>): LocationFix => ({
    id: "f",
    event: "clock_in",
    status: "captured",
    requestedAt: MON_18,
    capturedAt: MON_18 + 9_000,
    latitude: -6.8,
    longitude: 39.28,
    accuracyM: 12.4,
    placeLabel: "Office",
    ...over,
  });
  it("formats a captured fix with accuracy and seconds", () => {
    expect(capturedLocationLine(fix({}), ZONE)).toBe("Office · ±12 m · 18:00:09");
    expect(capturedLocationLine(fix({ placeLabel: null, accuracyM: null }), ZONE)).toBe("Location captured · 18:00:09");
  });
  it("picks the newest fix", () => {
    const older = fix({ id: "a", status: "denied", requestedAt: MON_18 });
    const newer = fix({ id: "b", requestedAt: MON_18 + 60_000 });
    expect(latestFix({ locations: [newer, older] })?.id).toBe("b");
    expect(latestFix({ locations: [] })).toBeNull();
  });
});

describe("small helpers", () => {
  it("splits the stopwatch at the seconds", () => {
    expect(splitStopwatch("06:42:10")).toEqual(["06:42", ":10"]);
    expect(splitStopwatch("123:00:01")).toEqual(["123:00", ":01"]);
  });
  it("counts the undo window down, never below zero", () => {
    expect(undoSecondsLeft(10_000, 2_100)).toBe(8);
    expect(undoSecondsLeft(10_000, 12_000)).toBe(0);
  });
  it("parses tags", () => {
    expect(parseTags("client a, urgent ,, Urgent, x")).toEqual(["client a", "urgent", "x"]);
    expect(parseTags("")).toEqual([]);
  });
  it("words the rhythm forgivingly", () => {
    expect(
      rhythmLines({
        current: 0,
        best: 4,
        freezesAvailable: 0,
        todayStatus: "pending",
      }),
    ).toEqual({
      headline: "A fresh start",
      today: "Today is still open. No pressure.",
      freezes: "No freezes saved yet. One builds up every 7 days you log.",
    });
    const r = rhythmLines({
      current: 5,
      best: 9,
      freezesAvailable: 1,
      todayStatus: "rest",
    });
    expect(r.headline).toBe("5-day rhythm");
    expect(r.today).toBe("Today is a rest day. Enjoy it.");
    expect(r.freezes).toBe("1 freeze saved. A missed day won't break your rhythm.");
  });
});

describe("weekBars (calendar mode, Mon–Sun)", () => {
  it("allocates a midnight-crossing session to both days and highlights today", () => {
    const s = session({ endedAt: Date.UTC(2026, 9, 27, 7, 0) }); // Mon 18:00 → Tue 10:00
    const now = Date.UTC(2026, 9, 28, 9, 0); // Wed
    const facts = sessionFacts([s], now);
    const week = summarize(dailyTotals(facts, "calendar"), rangeFor("week", "2026-10-28", 1), "calendar");
    expect(week.netMs).toBe(16 * H);
    const bars = weekBars(week.series, "2026-10-28");
    expect(bars.map((b) => b.letter).join("")).toBe("MTWTFSS");
    expect(bars[0].netMs).toBe(6 * H);
    expect(bars[1].netMs).toBe(10 * H);
    expect(bars[1].ratio).toBe(1);
    expect(bars[0].ratio).toBeCloseTo(0.6);
    expect(bars.findIndex((b) => b.isToday)).toBe(2);
    expect(bars.filter((b) => b.isFuture)).toHaveLength(4);
  });
  it("has zero ratios for an empty week", () => {
    const week = summarize(new Map(), rangeFor("week", "2026-10-28", 1), "calendar");
    expect(weekBars(week.series, "2026-10-28").every((b) => b.ratio === 0)).toBe(true);
  });
});
