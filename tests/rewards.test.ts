import { describe, expect, it } from "vitest";

import {
  ACHIEVEMENTS,
  computeRewards,
  ledgerTotal,
  levelForXp,
  progressInLevel,
  reconcileLedger,
  xpForLevel,
  type RewardInput,
  type RewardsResult,
} from "@/lib/rewards";
import { breakEndEvent, breakStartEvent, clockInEvent, clockOutEvent, correctEvent, manualCreateEvent, simpleEvent, type EventContext } from "@/lib/shifts/events";
import { achievementSchema, defaultSettings, ledgerEntrySchema, type Activity, type EarnedAchievement, type LedgerEntry, type Settings } from "@/lib/shifts/profile";
import { applyEvent, foldEvents } from "@/lib/shifts/reducer";
import { EMPTY_STATE, type ShiftBreak, type ShiftEvent, type ShiftSession, type ShiftState } from "@/lib/shifts/types";
import { sessionMetrics } from "@/lib/time/allocate";
import { addDays, fromWallClockInput, offsetMs, startOfLocalDay, weekdayOf } from "@/lib/time/zone";

// ── Harness: real sessions through the event builders and the reducer ───────────────────────────────
const DAR = "Africa/Dar_es_Salaam";
const MIN = 60_000;
const HOUR = 60 * MIN;

let counter = 0;
const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

class History {
  state: ShiftState = EMPTY_STATE;
  events: ShiftEvent[] = [];
  constructor(readonly zone = DAR) {}

  at(value: string): number {
    const instant = fromWallClockInput(value, this.zone);
    if (instant === null) throw new Error(`Bad time ${value}`);
    return instant;
  }

  ctx(when: string): EventContext {
    return { now: this.at(when), deviceTimeZone: this.zone, newId };
  }

  apply(event: ShiftEvent): void {
    const result = applyEvent(this.state, event);
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
    this.state = result.state;
    this.events.push(event);
  }

  clockIn(start: string): string {
    const event = clockInEvent(this.ctx(start), { goalSeconds: 16 * 3600, reportingTimeZone: this.zone });
    this.apply(event);
    return event.sessionId;
  }

  /** A timer session (clock in, breaks, clock out), times as local wall clock `YYYY-MM-DDTHH:mm`. */
  timer(start: string, end: string, breaks: [string, string][] = []): string {
    const id = this.clockIn(start);
    for (const [from, to] of breaks) {
      const b = breakStartEvent(this.ctx(from), id);
      this.apply(b);
      this.apply(breakEndEvent(this.ctx(to), id, b.breakId));
    }
    this.apply(clockOutEvent(this.ctx(end), id));
    return id;
  }

  breaks(spans: [string, string][]): ShiftBreak[] {
    return spans.map(([from, to]) => ({ id: newId(), startedAt: this.at(from), endedAt: this.at(to), kind: "rest" }));
  }

  manual(start: string, end: string, breaks: [string, string][] = []): string {
    const event = manualCreateEvent(this.ctx(end), {
      startedAt: this.at(start),
      endedAt: this.at(end),
      breaks: this.breaks(breaks),
      goalSeconds: 16 * 3600,
      reportingTimeZone: this.zone,
    });
    this.apply(event);
    return event.sessionId;
  }

  correct(id: string, when: string, changes: { start?: string; end?: string; breaks?: [string, string][] }): void {
    this.apply(
      correctEvent(this.ctx(when), id, {
        reason: "Fixing the times",
        expectedRevision: this.state.sessions[id].revision,
        startedAt: changes.start ? this.at(changes.start) : undefined,
        endedAt: changes.end ? this.at(changes.end) : undefined,
        breaks: changes.breaks ? this.breaks(changes.breaks) : undefined,
      }),
    );
  }

  remove(id: string, when: string): void {
    this.apply(simpleEvent(this.ctx(when), "delete", id));
  }

  get sessions(): ShiftSession[] {
    return Object.values(this.state.sessions);
  }
}

function settingsFor(zone = DAR, patch: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(zone), ...patch };
}

function rewardsFor(h: History, today: string, extra: Partial<RewardInput> = {}) {
  return computeRewards({
    sessions: h.sessions,
    activities: [] as Activity[],
    settings: settingsFor(h.zone),
    today,
    now: h.at(`${today}T12:00`),
    earned: [],
    ...extra,
  });
}

/** Persist a run the way the app does: append ledger rows and new achievements. */
function persist(profile: { ledger: LedgerEntry[]; earned: EarnedAchievement[] }, result: RewardsResult) {
  const rows = reconcileLedger(profile.ledger, result.targets);
  profile.ledger.push(...rows);
  profile.earned.push(...result.newAchievements.map((a) => ({ code: a.code, earnedAt: a.earnedAt, sourceSessionId: a.sourceSessionId })));
  return rows;
}

const targetXp = (r: RewardsResult, key: string) => r.targets.find((t) => t.key === key)?.xp ?? 0;
const codes = (r: RewardsResult) => r.achievements.map((a) => a.code);
/** XP of the per-session rules only (achievements are one-time and checked separately). */
const sessionRuleXp = (r: RewardsResult, id: string) => r.targets.filter((t) => t.sourceSessionId === id && t.rule !== "achievement").reduce((s, t) => s + t.xp, 0);

// 2026-10-26 is a Monday.

describe("determinism and idempotent reconciliation", () => {
  function history() {
    const h = new History();
    h.timer("2026-10-26T08:00", "2026-10-26T16:30", [["2026-10-26T12:00", "2026-10-26T12:30"]]);
    h.timer("2026-10-27T22:00", "2026-10-28T06:00", [["2026-10-28T02:00", "2026-10-28T02:20"]]);
    h.manual("2026-10-29T09:00", "2026-10-29T13:00");
    return h;
  }

  it("the same history gives the same result, whatever the order of the sessions", () => {
    const h = history();
    const a = rewardsFor(h, "2026-11-03");
    const b = computeRewards({ sessions: [...h.sessions].reverse(), activities: [], settings: settingsFor(), today: "2026-11-03", now: h.at("2026-11-03T12:00"), earned: [] });
    expect(b.targets).toEqual(a.targets);
    expect(b.achievements).toEqual(a.achievements);
    expect(b.totalXp).toBe(a.totalXp);
    // `now` only measures a running session: with none, a later `now` changes nothing.
    const later = rewardsFor(h, "2026-11-03", { now: h.at("2026-11-30T12:00") });
    expect(later.targets).toEqual(a.targets);
  });

  it("reconciling twice appends nothing, and two devices with the same events write identical rows", () => {
    const h = history();
    const ledger: LedgerEntry[] = [];
    const rows = reconcileLedger(ledger, rewardsFor(h, "2026-11-03").targets);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(ledgerEntrySchema.safeParse(row).success).toBe(true);
    expect(rows.every((r) => r.key.endsWith("#1") && r.xp > 0)).toBe(true);
    expect(ledgerTotal(rows)).toBe(rewardsFor(h, "2026-11-03").totalXp);
    expect(reconcileLedger(rows, rewardsFor(h, "2026-11-03").targets)).toEqual([]);

    const device2 = foldEvents(h.events, EMPTY_STATE);
    expect(device2.rejected).toEqual([]);
    const r2 = computeRewards({ sessions: Object.values(device2.state.sessions), activities: [], settings: settingsFor(), today: "2026-11-03", now: 0, earned: [] });
    expect(reconcileLedger([], r2.targets)).toEqual(rows);
  });

  it("row instants come from the history, never the wall clock", () => {
    const h = new History();
    const id = h.timer("2026-10-26T08:00", "2026-10-26T16:30", [["2026-10-26T12:00", "2026-10-26T12:30"]]);
    const rows = reconcileLedger([], rewardsFor(h, "2026-10-27").targets);
    const complete = rows.find((r) => r.key === `complete:${id}#1`)!;
    expect(complete.at).toBe(h.at("2026-10-26T16:30"));
    expect(rows.find((r) => r.key === "achievement:first_clock_in#1")!.at).toBe(h.at("2026-10-26T08:00"));
  });
});

describe("no bonus for long hours", () => {
  it("a 20h session earns exactly what an 8h one does", () => {
    const short = new History();
    const s = short.timer("2026-10-27T01:00", "2026-10-27T09:30", [["2026-10-27T05:00", "2026-10-27T05:30"]]);
    const long = new History();
    const l = long.timer("2026-10-27T01:00", "2026-10-27T21:30", [["2026-10-27T05:00", "2026-10-27T05:30"]]);
    expect(sessionMetrics(short.state.sessions[s], 0).netMs).toBe(8 * HOUR);
    expect(sessionMetrics(long.state.sessions[l], 0).netMs).toBe(20 * HOUR);
    const a = rewardsFor(short, "2026-10-28");
    const b = rewardsFor(long, "2026-10-28");
    expect(b.xpBySession[l]).toBe(a.xpBySession[s]);
    expect(b.totalXp).toBe(a.totalXp);
    expect(b.totalXp).toBeLessThanOrEqual(a.totalXp);
  });

  it("per-session XP is flat from 4h to 30h net, and going past the goal changes nothing", () => {
    const xp = new Set<number>();
    for (let hours = 4; hours <= 30; hours += 2) {
      const h = new History();
      const start = h.at("2026-10-27T01:00");
      const end = start + hours * HOUR + 30 * MIN;
      const id = h.manual("2026-10-27T01:00", toWall(h, end), [["2026-10-27T03:00", "2026-10-27T03:30"]]);
      xp.add(sessionRuleXp(rewardsFor(h, "2026-10-29"), id));
    }
    expect([...xp]).toEqual([20 + 10 + 5]);
  });

  it("thresholds only: under 30 minutes earns nothing for the session; a tiny break isn't a healthy break", () => {
    const h = new History();
    const tiny = h.timer("2026-10-27T09:00", "2026-10-27T09:20");
    const longNoRealBreak = h.timer("2026-10-27T10:00", "2026-10-27T15:00", [["2026-10-27T12:00", "2026-10-27T12:05"]]);
    const r = rewardsFor(h, "2026-10-28");
    expect(sessionRuleXp(r, tiny)).toBe(0);
    expect(r.summaryForSession(tiny).notes[0]).toMatch(/30 minutes/);
    expect(targetXp(r, `break:${longNoRealBreak}`)).toBe(0);
    expect(targetXp(r, `complete:${longNoRealBreak}`)).toBe(20);
  });
});

/** `YYYY-MM-DDTHH:mm` wall clock of an instant in the history's zone. */
function toWall(h: History, instant: number): string {
  return new Date(instant + offsetMs(instant, h.zone)).toISOString().slice(0, 16);
}

describe("daily cap", () => {
  it("only the earliest two completions of an anchor date earn completion XP; the day counts once", () => {
    const h = new History();
    const a = h.timer("2026-10-27T13:00", "2026-10-27T14:00");
    const b = h.timer("2026-10-27T09:00", "2026-10-27T10:00");
    const c = h.timer("2026-10-27T11:00", "2026-10-27T12:00");
    const r = rewardsFor(h, "2026-10-28");
    expect(targetXp(r, `complete:${b}`)).toBe(20);
    expect(targetXp(r, `complete:${c}`)).toBe(20);
    expect(targetXp(r, `complete:${a}`)).toBe(0);
    expect(targetXp(r, `live:${a}`)).toBe(0);
    expect(r.targets.filter((t) => t.key.startsWith("day:")).map((t) => [t.key, t.xp])).toEqual([["day:2026-10-27", 5]]);
    expect(r.summaryForSession(a).notes[0]).toMatch(/2 sessions a day/);
  });
});

describe("edits and replays", () => {
  it("correcting a session so it no longer qualifies appends reversal rows dated at the correction", () => {
    const h = new History();
    const id = h.timer("2026-10-27T09:00", "2026-10-27T17:00", [["2026-10-27T12:00", "2026-10-27T12:30"]]);
    const profile = { ledger: [] as LedgerEntry[], earned: [] as EarnedAchievement[] };
    persist(profile, rewardsFor(h, "2026-10-28"));
    const before = ledgerTotal(profile.ledger);

    h.correct(id, "2026-10-28T08:00", { end: "2026-10-27T09:20", breaks: [] });
    const rows = persist(profile, rewardsFor(h, "2026-10-28", { earned: profile.earned }));
    expect(rows.map((r) => [r.key, r.xp, r.rule])).toEqual([
      [`break:${id}#2`, -10, "reversal"],
      [`complete:${id}#2`, -20, "reversal"],
      [`day:2026-10-27#2`, -5, "reversal"],
      [`live:${id}#2`, -5, "reversal"],
    ]);
    expect(rows.every((r) => r.at === h.at("2026-10-28T08:00"))).toBe(true);
    expect(ledgerTotal(profile.ledger)).toBe(before - 40);
    // first_clock_in is sticky
    expect(ledgerTotal(profile.ledger)).toBe(25);
    expect(reconcileLedger(profile.ledger, rewardsFor(h, "2026-10-28", { earned: profile.earned }).targets)).toEqual([]);

    // Correct it back: XP returns as new rows, never by editing old ones.
    h.correct(id, "2026-10-28T09:00", { end: "2026-10-27T17:00" });
    const back = persist(profile, rewardsFor(h, "2026-10-28", { earned: profile.earned }));
    expect(back.map((r) => r.key).sort()).toEqual([`complete:${id}#3`, `day:2026-10-27#3`, `live:${id}#3`].sort());
    expect(ledgerTotal(profile.ledger)).toBe(25 + 20 + 5 + 5);
  });

  it("correcting times re-evaluates: adding a real break earns break XP; moving the start moves the day", () => {
    const h = new History();
    const id = h.timer("2026-10-27T09:00", "2026-10-27T17:00");
    expect(targetXp(rewardsFor(h, "2026-10-28"), `break:${id}`)).toBe(0);
    h.correct(id, "2026-10-27T18:00", { breaks: [["2026-10-27T12:00", "2026-10-27T12:30"]] });
    expect(targetXp(rewardsFor(h, "2026-10-28"), `break:${id}`)).toBe(10);
    h.correct(id, "2026-10-27T18:05", { start: "2026-10-26T23:00" });
    const r = rewardsFor(h, "2026-10-28");
    expect(targetXp(r, "day:2026-10-26")).toBe(5);
    expect(targetXp(r, "day:2026-10-27")).toBe(0);
    expect(codes(r)).toContain("night_owl");
  });

  it("delete then recreate can't farm completion or first_clock_in", () => {
    const h = new History();
    const profile = { ledger: [] as LedgerEntry[], earned: [] as EarnedAchievement[] };
    let id = h.timer("2026-10-27T09:00", "2026-10-27T17:00", [["2026-10-27T12:00", "2026-10-27T12:30"]]);
    const first = rewardsFor(h, "2026-10-28");
    persist(profile, first);
    const once = ledgerTotal(profile.ledger);
    expect(once).toBe(40 + 25);
    const firstClockIn = profile.earned.find((e) => e.code === "first_clock_in")!;

    for (let round = 0; round < 5; round++) {
      h.remove(id, `2026-10-27T18:0${round}`);
      id = h.timer("2026-10-27T09:00", "2026-10-27T17:00", [["2026-10-27T12:00", "2026-10-27T12:30"]]);
      const r = rewardsFor(h, "2026-10-28", { earned: profile.earned });
      expect(r.newAchievements).toEqual([]);
      persist(profile, r);
      expect(ledgerTotal(profile.ledger)).toBe(once);
      expect(r.totalXp).toBe(once);
    }
    expect(profile.earned.filter((e) => e.code === "first_clock_in")).toEqual([firstClockIn]);
    expect(profile.ledger.filter((r) => r.key.startsWith("achievement:first_clock_in"))).toHaveLength(1);
  });

  it("deleting the third session of a day lets no one farm; the cap still holds", () => {
    const h = new History();
    const profile = { ledger: [] as LedgerEntry[], earned: [] as EarnedAchievement[] };
    const ids = ["09", "11", "13"].map((hh) => h.timer(`2026-10-27T${hh}:00`, `2026-10-27T${hh}:45`));
    persist(profile, rewardsFor(h, "2026-10-28"));
    h.remove(ids[0], "2026-10-27T20:00");
    const r = rewardsFor(h, "2026-10-28", { earned: profile.earned });
    persist(profile, r);
    expect(targetXp(r, `complete:${ids[2]}`)).toBe(20);
    expect(profile.ledger.filter((x) => x.key.startsWith("complete:")).reduce((s, x) => s + x.xp, 0)).toBe(40);
  });

  it("leaves keys from a newer version alone and never reverses an achievement", () => {
    const existing: LedgerEntry[] = [
      { key: "future_rule:x#1", rule: "routine", xp: 10, sourceSessionId: null, at: 1 },
      { key: "achievement:night_owl#1", rule: "achievement", xp: 30, sourceSessionId: null, at: 2 },
      { key: "day:2026-10-20#1", rule: "routine", xp: 5, sourceSessionId: null, at: 3 },
      { key: "day:2026-10-20#2", rule: "reversal", xp: -5, sourceSessionId: null, at: 4 },
      { key: "day:2026-10-21#1", rule: "routine", xp: 5, sourceSessionId: null, at: 7 },
    ];
    expect(reconcileLedger(existing, [])).toEqual([{ key: "day:2026-10-21#2", rule: "reversal", xp: -5, sourceSessionId: null, at: 7 }]);
  });
});

describe("rest days", () => {
  it("a planned rest day with no work is rewarded, dated at its end", () => {
    const h = new History();
    for (let d = 26; d <= 31; d++) h.timer(`2026-10-${d}T09:00`, `2026-10-${d}T17:00`);
    const r = rewardsFor(h, "2026-11-03");
    expect(r.targets.filter((t) => t.key.startsWith("rest:")).map((t) => [t.key, t.xp, t.at])).toEqual([
      ["rest:2026-11-01", 5, startOfLocalDay("2026-11-02", DAR)],
    ]);
  });

  it("no rest XP before the first session, for today, on a day someone clocked in, or after time away", () => {
    const h = new History();
    h.timer("2026-10-26T09:00", "2026-10-26T17:00");
    h.timer("2026-10-31T20:00", "2026-11-01T02:00"); // Saturday night into Sunday
    const r = rewardsFor(h, "2026-11-01");
    expect(r.targets.some((t) => t.key.startsWith("rest:"))).toBe(false);
    // Weeks later: only rest days right after work count.
    const later = rewardsFor(h, "2026-12-20");
    expect(later.targets.filter((t) => t.key.startsWith("rest:"))).toEqual([]);
  });

  it("at most two rest awards a week, even with few planned days", () => {
    const h = new History();
    h.timer("2026-10-26T09:00", "2026-10-26T17:00");
    const r = rewardsFor(h, "2026-11-03", { settings: settingsFor(DAR, { plannedWeekdays: [1] }) });
    expect(r.targets.filter((t) => t.key.startsWith("rest:")).map((t) => t.key)).toEqual(["rest:2026-10-27", "rest:2026-10-28"]);
  });
});

describe("achievements", () => {
  it("comeback after a week away, with welcoming copy", () => {
    const h = new History();
    h.timer("2026-10-26T09:00", "2026-10-26T17:00");
    const back = h.timer("2026-11-05T09:00", "2026-11-05T17:00");
    const r = rewardsFor(h, "2026-11-06");
    const comeback = r.achievements.find((a) => a.code === "comeback")!;
    expect(comeback.sourceSessionId).toBe(back);
    expect(comeback.earnedAt).toBe(h.at("2026-11-05T09:00"));
    for (const a of ACHIEVEMENTS) expect(`${a.name} ${a.description} ${a.hint}`).not.toMatch(/lost|broke|fail|lazy|shame|finally|missed (a|your)/i);

    const close = new History();
    close.timer("2026-10-26T09:00", "2026-10-26T17:00");
    close.timer("2026-11-02T09:00", "2026-11-02T17:00"); // 6 days 16 hours after the last end
    expect(codes(rewardsFor(close, "2026-11-06"))).not.toContain("comeback");
  });

  it("night owl across midnight on a DST day (Europe/London, 25h day)", () => {
    const h = new History("Europe/London");
    const id = h.timer("2026-10-24T22:00", "2026-10-25T06:00");
    expect(sessionMetrics(h.state.sessions[id], 0).netMs).toBe(9 * HOUR);
    const r = rewardsFor(h, "2026-10-26");
    expect(r.achievements.find((a) => a.code === "night_owl")?.sourceSessionId).toBe(id);
    expect(r.targets.filter((t) => t.key.startsWith("day:")).map((t) => t.key)).toEqual(["day:2026-10-24"]);

    const atMidnight = new History("Europe/London");
    atMidnight.timer("2026-10-24T20:00", "2026-10-25T00:00");
    expect(codes(rewardsFor(atMidnight, "2026-10-26"))).not.toContain("night_owl");
  });

  it("first clock-in needs the timer; a manual entry earns no live XP", () => {
    const h = new History();
    const id = h.manual("2026-10-26T09:00", "2026-10-26T17:00");
    const r = rewardsFor(h, "2026-10-27");
    expect(codes(r)).not.toContain("first_clock_in");
    expect(targetXp(r, `live:${id}`)).toBe(0);
    expect(targetXp(r, `complete:${id}`)).toBe(20);
  });

  it("a running session already earns first clock-in and keeps the rhythm through midnight", () => {
    const h = new History();
    h.clockIn("2026-10-27T22:00");
    const r = rewardsFor(h, "2026-10-28", { now: h.at("2026-10-28T02:00") });
    expect(codes(r)).toEqual(["first_clock_in"]);
    expect(r.rhythm.current).toBe(1);
    expect(r.rhythm.todayStatus).toBe("pending");
  });

  it("early bird, consistency week, data keeper, weekly reviewer", () => {
    const h = new History();
    for (let d = 26; d <= 30; d++) h.timer(`2026-10-${d}T06:30`, `2026-10-${d}T14:00`);
    const activities: Activity[] = [
      { id: "e1", type: "export", key: "", at: h.at("2026-10-31T10:00") },
      ...["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-17"].map((key, i) => ({ id: `r${i}`, type: "week_review" as const, key, at: h.at(`${addDays(key, 6)}T19:00`) })),
    ];
    const r = rewardsFor(h, "2026-11-23", { activities });
    expect(codes(r)).toEqual(expect.arrayContaining(["early_bird", "consistency_week", "data_keeper", "weekly_reviewer"]));
    expect(r.achievements.find((a) => a.code === "consistency_week")!.earnedAt).toBe(h.at("2026-10-30T14:00"));
    // Two reviews in the same week count once.
    expect(r.targets.filter((t) => t.key.startsWith("review:")).map((t) => t.key)).toEqual([
      "review:2026-10-26",
      "review:2026-11-02",
      "review:2026-11-09",
      "review:2026-11-16",
    ]);
    expect(r.achievements.find((a) => a.code === "weekly_reviewer")!.earnedAt).toBe(h.at("2026-11-22T19:00"));
  });

  it("break champion after ten sessions with breaks; first 100h is a total, crossed by the 13th 8h session", () => {
    const h = new History();
    let day = "2026-10-26";
    const ids: string[] = [];
    while (ids.length < 13) {
      ids.push(h.timer(`${day}T09:00`, `${day}T17:30`, [[`${day}T12:00`, `${day}T12:30`]]));
      day = addDays(day, 1);
    }
    const r = rewardsFor(h, day);
    expect(r.achievements.find((a) => a.code === "break_champion")!.sourceSessionId).toBe(ids[9]);
    expect(r.achievements.find((a) => a.code === "first_100h")!.sourceSessionId).toBe(ids[12]);
  });

  it("rest respecter after eight rewarded rest days", () => {
    const h = new History();
    let day = "2026-10-26";
    for (let i = 0; i < 28; i++, day = addDays(day, 1)) {
      if (weekdayOf(day) >= 1 && weekdayOf(day) <= 5) h.timer(`${day}T09:00`, `${day}T17:00`);
    }
    const r = rewardsFor(h, day, { settings: settingsFor(DAR, { plannedWeekdays: [1, 2, 3, 4, 5] }) });
    expect(r.targets.filter((t) => t.key.startsWith("rest:"))).toHaveLength(8);
    expect(r.achievements.find((a) => a.code === "rest_respecter")!.earnedAt).toBe(startOfLocalDay("2026-11-23", DAR));
  });

  it("achievements are sticky: an edit removing the qualifying session keeps them and their XP", () => {
    const h = new History();
    const id = h.timer("2026-10-26T22:00", "2026-10-27T06:00");
    const profile = { ledger: [] as LedgerEntry[], earned: [] as EarnedAchievement[] };
    const first = rewardsFor(h, "2026-10-28");
    expect(first.newAchievements.map((a) => a.code)).toEqual(["first_clock_in", "night_owl"]);
    persist(profile, first);
    for (const e of profile.earned) expect(achievementSchema.safeParse(e).success).toBe(true);

    h.correct(id, "2026-10-28T09:00", { start: "2026-10-27T00:30" });
    const r = rewardsFor(h, "2026-10-28", { earned: profile.earned });
    expect(codes(r)).toContain("night_owl");
    expect(r.newAchievements).toEqual([]);
    expect(targetXp(r, "achievement:night_owl")).toBe(30);
    const rows = persist(profile, r);
    expect(rows.some((row) => row.key.startsWith("achievement:"))).toBe(false);
    h.remove(id, "2026-10-28T10:00");
    const gone = rewardsFor(h, "2026-10-28", { earned: profile.earned });
    expect(codes(gone)).toEqual(["first_clock_in", "night_owl"]);
    expect(gone.totalXp).toBe(25 + 30);
  });
});

describe("levels", () => {
  it("gentle curve with known thresholds, monotonic", () => {
    expect([0, 49, 50, 149, 150, 500, 2249, 2250].map(levelForXp)).toEqual([1, 1, 2, 2, 3, 5, 9, 10]);
    expect(xpForLevel(5)).toBe(500);
    expect(xpForLevel(10)).toBe(2250);
    let last = 1;
    for (let xp = -10; xp < 20_000; xp += 7) {
      const level = levelForXp(xp);
      expect(level).toBeGreaterThanOrEqual(last);
      last = level;
    }
    expect(progressInLevel(175)).toEqual({ level: 3, xpIntoLevel: 25, levelSpan: 150, xpToNext: 125, ratio: 25 / 150 });
  });

  it("the displayed level never decreases below the highest reached", () => {
    const h = new History();
    h.timer("2026-10-26T09:00", "2026-10-26T17:00");
    const r = rewardsFor(h, "2026-10-27", { highestLevel: 7 });
    expect(r.xpLevel).toBe(levelForXp(r.totalXp));
    expect(r.xpLevel).toBeLessThan(7);
    expect(r.level).toBe(7);
    expect(r.progress).toMatchObject({ level: 7, xpIntoLevel: 0, xpToNext: xpForLevel(8) - r.totalXp });
  });

  it("a regular user reaches level 5 in about two weeks and level 10 in about two months", () => {
    const h = new History();
    const settings = settingsFor(DAR, { plannedWeekdays: [1, 2, 3, 4, 5] });
    const activities: Activity[] = [];
    const levels: Record<string, number> = {};
    let day = "2026-11-02";
    for (let i = 0; i < 70; i++, day = addDays(day, 1)) {
      const wd = weekdayOf(day);
      if (wd >= 1 && wd <= 5) h.timer(`${day}T08:30`, `${day}T17:00`, [[`${day}T12:30`, `${day}T13:00`]]);
      if (wd === 0) activities.push({ id: `rev-${day}`, type: "week_review", key: addDays(day, -6), at: h.at(`${day}T18:00`) });
      levels[addDays(day, 1)] = computeRewards({ sessions: h.sessions, activities, settings, today: addDays(day, 1), now: h.at(`${day}T23:00`), earned: [] }).level;
    }
    expect(levels["2026-11-16"]).toBe(5);
    expect(levels["2026-12-28"]).toBeLessThan(10);
    expect(levels["2027-01-04"]).toBe(10);
  });
});

describe("rhythm via computeRewards", () => {
  it("rest days are neutral and today is pending, not broken", () => {
    const h = new History();
    for (const d of ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-11-02"]) h.timer(`${d}T09:00`, `${d}T17:00`);
    const r = rewardsFor(h, "2026-11-03", { settings: settingsFor(DAR, { plannedWeekdays: [1, 2, 3, 4, 5] }) });
    expect(r.rhythm).toMatchObject({ current: 6, best: 6, todayStatus: "pending" });
  });
});
