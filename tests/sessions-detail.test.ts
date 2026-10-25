import { describe, expect, it } from "vitest";

import { applyEvent } from "@/lib/shifts/reducer";
import { EMPTY_STATE, type ShiftBreak, type ShiftSession, type ShiftState } from "@/lib/shifts/types";
import {
  checkCorrection,
  checkManual,
  defaultManualTimes,
  draftFromSession,
  longSessionWarning,
  reasonProblem,
  resolveDraft,
  resolveInput,
} from "@/lib/sessions/draft";
import { daySplit, timelineItems } from "@/lib/sessions/geometry";
import { rezoneChanges, rezonePreview } from "@/lib/sessions/rezone";
import { accuracyCopy, apportionMinutes, describeChanges, formatRange, goalCopy } from "@/lib/sessions/wording";
import { fromWallClockInput, toWallClockInput } from "@/lib/time/zone";

const H = 3_600_000;
const M = 60_000;
const DAR = "Africa/Dar_es_Salaam";
const LONDON = "Europe/London";
const NY = "America/New_York";
const at = (v: string, zone = DAR) => fromWallClockInput(v, zone)!;
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function manual(state: ShiftState, start: string, end: string, breaks: [string, string][] = [], zone = DAR) {
  const b: ShiftBreak[] = breaks.map(([s, e]) => ({ id: id(), startedAt: at(s, zone), endedAt: at(e, zone), kind: "rest" }));
  const t = at(end, zone);
  const r = applyEvent(state, {
    id: id(),
    at: t,
    recordedAt: t,
    deviceTimeZone: zone,
    type: "manual_create",
    sessionId: id(),
    startedAt: at(start, zone),
    endedAt: t,
    breaks: b,
    goalSeconds: 16 * 3600,
    reportingTimeZone: zone,
  });
  if (!r.ok) throw new Error(r.error.message);
  return { state: r.state, session: r.session! };
}

describe("day-split geometry", () => {
  it("cuts the acceptance shift at midnight with the break as its own part", () => {
    const { session } = manual(EMPTY_STATE, "2026-10-26T18:00", "2026-10-27T10:00", [["2026-10-27T02:00", "2026-10-27T02:30"]]);
    const split = daySplit(session, 0);
    expect(split.totalMs).toBe(16 * H);
    expect(split.boundaries.map((b) => [b.date, b.frac])).toEqual([["2026-10-27", 6 / 16]]);
    expect(split.days.map((d) => [d.date, d.netMs / M, d.breakMs / M, d.startFrac, d.endFrac])).toEqual([
      ["2026-10-26", 360, 0, 0, 6 / 16],
      ["2026-10-27", 570, 30, 6 / 16, 1],
    ]);
    expect(split.parts.map((p) => p.kind)).toEqual(["work", "work", "break", "work"]);
    expect(split.parts.find((p) => p.kind === "break")?.breakKind).toBe("rest");
    // The band is continuous: each part starts where the previous ended.
    split.parts.forEach((p, i) => i > 0 && expect(p.startFrac).toBe(split.parts[i - 1].endFrac));
  });

  it("draws a cross-midnight shift over the October DST change in London by real elapsed time", () => {
    // Sat 24 Oct 2026 18:00 BST → Sun 25 Oct 10:00 GMT: clocks go back at 02:00, so this is 17 hours.
    const { session } = manual(EMPTY_STATE, "2026-10-24T18:00", "2026-10-25T10:00", [], LONDON);
    const split = daySplit(session, 0);
    expect(split.totalMs).toBe(17 * H);
    expect(split.days.map((d) => [d.date, d.netMs / H])).toEqual([
      ["2026-10-24", 6],
      ["2026-10-25", 11],
    ]);
    expect(split.boundaries).toHaveLength(1);
    expect(split.boundaries[0].frac).toBeCloseTo(6 / 17, 12);
    expect(split.days[1].endFrac - split.days[1].startFrac).toBeCloseTo(11 / 17, 12);
  });

  it("handles the short spring-forward night in New York (23-hour day)", () => {
    // Sat 7 Mar 2026 20:00 EST → Sun 8 Mar 08:00 EDT = 11 hours.
    const { session } = manual(EMPTY_STATE, "2026-03-07T20:00", "2026-03-08T08:00", [["2026-03-08T01:30", "2026-03-08T03:30"]], NY);
    const split = daySplit(session, 0);
    expect(split.totalMs).toBe(11 * H);
    // 01:30 EST → 03:30 EDT is one real hour.
    expect(split.days.map((d) => [d.date, d.netMs / H, d.breakMs / H])).toEqual([
      ["2026-03-07", 4, 0],
      ["2026-03-08", 6, 1],
    ]);
    const total = split.days.reduce((s, d) => s + d.netMs + d.breakMs, 0);
    expect(total).toBe(split.totalMs);
  });

  it("runs to now for a live session and lists the timeline in reading order", () => {
    let state = EMPTY_STATE;
    const start = at("2026-10-26T22:00");
    const r = applyEvent(state, { id: id(), at: start, recordedAt: start, deviceTimeZone: DAR, type: "clock_in", sessionId: id(), goalSeconds: 57600, reportingTimeZone: DAR });
    if (!r.ok) throw new Error(r.error.message);
    state = r.state;
    const split = daySplit(r.session!, at("2026-10-27T03:00"));
    expect(split.running).toBe(true);
    const items = timelineItems(split);
    expect(items.map((i) => (i.kind === "pin" ? i.pin : i.kind))).toEqual(["clock_in", "work", "midnight", "work", "now"]);
    const midnight = items.find((i) => i.kind === "midnight");
    expect(midnight && midnight.kind === "midnight" && midnight.date).toBe("2026-10-27");
  });
});

describe("wording", () => {
  it("formats ranges with the day offset", () => {
    expect(formatRange(at("2026-10-26T18:00"), at("2026-10-27T10:00"), DAR)).toBe("18:00 → 10:00 +1");
    expect(formatRange(at("2026-10-26T08:00"), at("2026-10-26T17:30"), DAR, "12h")).toBe("8:00 am → 5:30 pm");
    expect(formatRange(at("2026-10-26T08:00"), null, DAR)).toBe("08:00 → now");
  });

  it("describes a correction in plain words", () => {
    const b1: ShiftBreak = { id: "b1", startedAt: at("2026-10-27T02:00"), endedAt: at("2026-10-27T02:30"), kind: "rest" };
    const previous = { startedAt: at("2026-10-26T18:00"), endedAt: at("2026-10-27T10:00"), breaks: [b1] };
    const updated = {
      startedAt: at("2026-10-26T17:40"),
      endedAt: at("2026-10-27T10:00"),
      breaks: [{ ...b1, endedAt: at("2026-10-27T02:45"), kind: "meal" as const }, { id: "b2", startedAt: at("2026-10-27T06:00"), endedAt: at("2026-10-27T06:15"), kind: "rest" as const }],
    };
    expect(describeChanges(previous, updated, DAR)).toEqual([
      "Start 18:00 → 17:40",
      "Break 02:00–02:30 → 02:00–02:45",
      "Break 02:00–02:45 is now a meal break",
      "Added a 15m rest break 06:00–06:15",
      "Net 15h 30m → 15h 20m",
    ]);
    expect(describeChanges(updated, { ...updated, breaks: [], startedAt: at("2026-10-25T23:00") }, DAR)[0]).toBe("Start Mon 26 Oct 17:40 → Sun 25 Oct 23:00");
    expect(describeChanges(updated, { ...updated, breaks: updated.breaks.slice(1) }, DAR)[0]).toBe("Removed the break 02:00–02:45");
  });

  it("apportions minutes so the shown days add up to the shown total", () => {
    const parts = [5 * H + 59.5 * M, 9 * H + 30.5 * M];
    expect(apportionMinutes(parts)).toEqual([360, 570]);
    expect(apportionMinutes(parts).reduce((s, m) => s + m, 0)).toBe(Math.floor((parts[0] + parts[1]) / M));
    expect(apportionMinutes([0, 0])).toEqual([0, 0]);
  });

  it("keeps goal and accuracy copy neutral and truthful", () => {
    expect(goalCopy(17.2 * H, 16 * 3600)).toBe("+1h 12m past your 16h goal");
    expect(goalCopy(12 * H, 16 * 3600)).toBe("12h of your 16h goal");
    expect(goalCopy(12 * H, 16 * 3600, true)).toBe("4h to your 16h goal");
    expect(accuracyCopy(12)).toBe("±12 m — GPS is approximate");
    expect(accuracyCopy(null)).toBeNull();
  });
});

describe("edit-times drafts", () => {
  function setup() {
    let state = EMPTY_STATE;
    const a = manual(state, "2026-10-26T18:00", "2026-10-27T10:00", [["2026-10-27T02:00", "2026-10-27T02:30"]]);
    state = a.state;
    const b = manual(state, "2026-10-27T12:00", "2026-10-27T16:00");
    state = b.state;
    return { state, a: state.sessions[a.session.id], b: state.sessions[b.session.id] };
  }

  it("keeps the recorded instant (with seconds) when a field is untouched", () => {
    const precise = at("2026-10-26T18:00") + 37_123;
    expect(resolveInput(toWallClockInput(precise, DAR), precise, DAR)).toBe(precise);
    expect(resolveInput("2026-10-26T18:05", precise, DAR)).toBe(at("2026-10-26T18:05"));
    expect(resolveInput("", precise, DAR)).toBeNull();
  });

  it("asks the reducer: unchanged, ok, chronology and overlap", () => {
    const { state, a } = setup();
    const now = at("2026-10-28T12:00");
    const draft = draftFromSession(a, DAR);
    const resolve = (d = draft) => {
      const r = resolveDraft(d, DAR, { running: false, original: a });
      if (!r.ok) throw new Error(r.message);
      return r.snapshot;
    };
    expect(checkCorrection(state, a, resolve(), now, DAR).status).toBe("unchanged");
    expect(checkCorrection(state, a, resolve({ ...draft, start: "2026-10-26T17:40" }), now, DAR)).toEqual({ status: "ok" });
    expect(checkCorrection(state, a, resolve({ ...draft, end: "2026-10-26T17:00" }), now, DAR)).toEqual({ status: "error", message: "The end must be after the start." });
    const overlap = checkCorrection(state, a, resolve({ ...draft, end: "2026-10-27T13:00" }), now, DAR);
    expect(overlap.status).toBe("overlap");
    expect(overlap.status === "overlap" && overlap.conflictingSessionId).toBe(Object.values(state.sessions).find((s) => s.id !== a.id)!.id);
  });

  it("reports which field can't be read, and requires a reason", () => {
    const { a } = setup();
    const draft = draftFromSession(a, DAR);
    const r = resolveDraft({ ...draft, breaks: [{ ...draft.breaks[0], end: "" }] }, DAR, { running: false, original: a });
    expect(r).toEqual({ ok: false, field: `break:${draft.breaks[0].id}:end`, message: "Enter when the break ended." });
    expect(reasonProblem(" ok")).not.toBeNull();
    expect(reasonProblem("Forgot to clock out")).toBeNull();
  });

  it("checks a manual entry: end in the past, overlap, and a long-session hint", () => {
    const { state } = setup();
    const now = at("2026-10-28T12:00");
    const snap = (s: string, e: string) => ({ startedAt: at(s), endedAt: at(e), breaks: [] });
    expect(checkManual(state, snap("2026-10-28T08:00", "2026-10-28T13:00"), DAR, 57600, now, DAR).status).toBe("error");
    expect(checkManual(state, snap("2026-10-27T15:00", "2026-10-27T18:00"), DAR, 57600, now, DAR).status).toBe("overlap");
    expect(checkManual(state, snap("2026-10-27T17:00", "2026-10-27T20:00"), DAR, 57600, now, DAR)).toEqual({ status: "ok" });
    expect(longSessionWarning(snap("2026-10-25T08:00", "2026-10-26T10:00"))).not.toBeNull();
    expect(defaultManualTimes(at("2026-10-28T12:00"), DAR)).toEqual({ start: "2026-10-27T09:00", end: "2026-10-27T17:00" });
    expect(defaultManualTimes(at("2026-10-28T18:00"), DAR).start).toBe("2026-10-28T09:00");
  });
});

describe("rezone preview", () => {
  it("moves the midnight, never the total", () => {
    const { session } = manual(EMPTY_STATE, "2026-10-26T18:00", "2026-10-27T10:00", [["2026-10-27T02:00", "2026-10-27T02:30"]]);
    const rows = rezonePreview(session as ShiftSession, "UTC", 0);
    // 18:00 EAT = 15:00 UTC and the break (02:00 EAT) falls at 23:00 UTC: 8h30 on Mon, 7h on Tue in UTC.
    expect(rows.map((r) => [r.date, r.beforeMs / M, r.afterMs / M])).toEqual([
      ["2026-10-26", 360, 510],
      ["2026-10-27", 570, 420],
    ]);
    expect(rows.reduce((s, r) => s + r.beforeMs, 0)).toBe(rows.reduce((s, r) => s + r.afterMs, 0));
    expect(rezoneChanges(rows)).toBe(true);
    expect(rezoneChanges(rezonePreview(session, DAR, 0))).toBe(false);
  });
});
