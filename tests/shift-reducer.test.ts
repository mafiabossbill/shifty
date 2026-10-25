import { describe, expect, it } from "vitest";

import { allocateByDay, sessionMetrics } from "@/lib/time/allocate";
import { fromWallClockInput } from "@/lib/time/zone";
import {
  breakEndEvent,
  breakStartEvent,
  clockInEvent,
  clockOutEvent,
  correctEvent,
  locationEvent,
  manualCreateEvent,
  simpleEvent,
  type EventContext,
} from "@/lib/shifts/events";
import { applyEvent, foldEvents } from "@/lib/shifts/reducer";
import { parseShiftEvent } from "@/lib/shifts/schema";
import { EMPTY_STATE, activeSession, sessionStatus, type ShiftEvent, type ShiftState } from "@/lib/shifts/types";

const DAR = "Africa/Dar_es_Salaam";
const H = 3_600_000;
const at = (v: string) => fromWallClockInput(v, DAR)!;

let counter = 0;
const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
const ctx = (time: string): EventContext => ({ now: at(time), deviceTimeZone: DAR, newId });

function apply(state: ShiftState, event: ShiftEvent): ShiftState {
  const result = applyEvent(state, event);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function clockIn(time: string, state = EMPTY_STATE) {
  const event = clockInEvent(ctx(time), { goalSeconds: 16 * 3600, reportingTimeZone: DAR });
  return { event, state: apply(state, event), id: event.sessionId };
}

describe("state machine", () => {
  it("INACTIVE → ACTIVE → ON_BREAK → ACTIVE → COMPLETED", () => {
    const first = clockIn("2026-10-26T18:00");
    let state = first.state;
    const id = first.id;
    expect(sessionStatus(state.sessions[id])).toBe("active");
    const start = breakStartEvent(ctx("2026-10-27T02:00"), id);
    state = apply(state, start);
    expect(sessionStatus(state.sessions[id])).toBe("on_break");
    state = apply(state, breakEndEvent(ctx("2026-10-27T02:30"), id, start.breakId));
    expect(sessionStatus(state.sessions[id])).toBe("active");
    state = apply(state, clockOutEvent(ctx("2026-10-27T10:00"), id));
    const s = state.sessions[id];
    expect(sessionStatus(s)).toBe("completed");
    expect(s.revision).toBe(4);
    // Fixture B end to end through the reducer.
    expect(sessionMetrics(s, 0).netMs).toBe(15.5 * H);
    expect(allocateByDay(s, 0).map((d) => [d.date, d.netMs / H])).toEqual([
      ["2026-10-26", 6],
      ["2026-10-27", 9.5],
    ]);
    expect(activeSession(state)).toBeNull();
  });

  it("the session id never changes across midnights and the original clock-in is kept", () => {
    const { state, id, event } = clockIn("2026-10-26T18:00");
    const done = apply(state, clockOutEvent(ctx("2026-10-29T06:00"), id));
    expect(Object.keys(done.sessions)).toEqual([id]);
    expect(done.sessions[id].originEventId).toBe(event.id);
    expect(done.sessions[id].originalStartedAt).toBe(at("2026-10-26T18:00"));
  });

  it("K: clock out during a break closes the break at the clock-out instant", () => {
    const first = clockIn("2026-10-26T09:00");
    let state = first.state;
    const id = first.id;
    state = apply(state, breakStartEvent(ctx("2026-10-26T16:00"), id));
    state = apply(state, clockOutEvent(ctx("2026-10-26T17:00"), id));
    const s = state.sessions[id];
    expect(s.breaks[0].endedAt).toBe(at("2026-10-26T17:00"));
    expect(sessionMetrics(s, 0).netMs).toBe(7 * H);
  });

  it("refuses impossible chronology", () => {
    const { state, id } = clockIn("2026-10-26T09:00");
    const early = applyEvent(state, clockOutEvent(ctx("2026-10-26T08:00"), id));
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.error.code).toBe("chronology");
    const breakBefore = applyEvent(state, breakStartEvent(ctx("2026-10-26T08:30"), id));
    expect(breakBefore.ok).toBe(false);
    const s2 = apply(state, breakStartEvent(ctx("2026-10-26T10:00"), id));
    const second = applyEvent(s2, breakStartEvent(ctx("2026-10-26T10:05"), id));
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("invalid_state");
  });

  it("a completed session can't be clocked out twice or take a break", () => {
    const first = clockIn("2026-10-26T09:00");
    let state = first.state;
    const id = first.id;
    state = apply(state, clockOutEvent(ctx("2026-10-26T17:00"), id));
    expect(applyEvent(state, clockOutEvent(ctx("2026-10-26T18:00"), id)).ok).toBe(false);
    expect(applyEvent(state, breakStartEvent(ctx("2026-10-26T18:00"), id)).ok).toBe(false);
  });
});

describe("J: duplicates and two devices", () => {
  it("the same clock-in replayed is a no-op", () => {
    const { state, event, id } = clockIn("2026-10-26T18:00");
    const again = applyEvent(state, event);
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.state).toBe(state);
      expect(Object.keys(again.state.sessions)).toEqual([id]);
    }
  });

  it("a second clock-in (other device, double tap with a new id) is refused with the running session named", () => {
    const { state, id } = clockIn("2026-10-26T18:00");
    const other = clockInEvent(ctx("2026-10-26T18:00"), { goalSeconds: 16 * 3600, reportingTimeZone: DAR });
    const result = applyEvent(state, other);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("active_exists");
      expect(result.error.conflictingSessionId).toBe(id);
    }
  });

  it("foldEvents reports rejected events and keeps the rest", () => {
    const a = clockInEvent(ctx("2026-10-26T18:00"), { goalSeconds: 57600, reportingTimeZone: DAR });
    const b = clockInEvent(ctx("2026-10-26T18:01"), { goalSeconds: 57600, reportingTimeZone: DAR });
    const out = clockOutEvent(ctx("2026-10-27T02:00"), a.sessionId);
    const { state, rejected } = foldEvents([a, b, out], EMPTY_STATE);
    expect(Object.keys(state.sessions)).toEqual([a.sessionId]);
    expect(rejected.map((r) => r.event.id)).toEqual([b.id]);
  });
});

describe("I: location never moves the start", () => {
  it("a denied location is recorded truthfully with no coordinates", () => {
    const first = clockIn("2026-10-26T18:00");
    let state = first.state;
    const id = first.id;
    state = apply(
      state,
      locationEvent(ctx("2026-10-26T18:00"), id, {
        event: "clock_in",
        status: "denied",
        requestedAt: at("2026-10-26T18:00"),
        capturedAt: null,
        latitude: null,
        longitude: null,
        accuracyM: null,
        placeLabel: null,
      }),
    );
    const s = state.sessions[id];
    expect(s.startedAt).toBe(at("2026-10-26T18:00"));
    expect(s.locations[0].status).toBe("denied");
    expect(s.locations[0].latitude).toBeNull();
  });

  it("a fix that arrives 20s later is attached without touching the start", () => {
    const first = clockIn("2026-10-26T18:00");
    let state = first.state;
    const id = first.id;
    state = apply(
      state,
      locationEvent(ctx("2026-10-26T18:01"), id, {
        event: "clock_in",
        status: "captured",
        requestedAt: at("2026-10-26T18:00"),
        capturedAt: at("2026-10-26T18:00") + 20_000,
        latitude: -6.8,
        longitude: 39.28,
        accuracyM: 14,
        placeLabel: null,
      }),
    );
    expect(state.sessions[id].startedAt).toBe(at("2026-10-26T18:00"));
    expect(state.sessions[id].locations[0].accuracyM).toBe(14);
  });

  it("a captured status without coordinates is refused (never fabricated)", () => {
    const { state, id } = clockIn("2026-10-26T18:00");
    const bad = locationEvent(ctx("2026-10-26T18:00"), id, {
      event: "clock_in",
      status: "captured",
      requestedAt: 0,
      capturedAt: null,
      latitude: null,
      longitude: null,
      accuracyM: null,
      placeLabel: null,
    });
    expect(applyEvent(state, bad).ok).toBe(false);
  });
});

describe("M: corrections", () => {
  function completed() {
    const first = clockIn("2026-10-26T18:00");
    let state = first.state;
    const id = first.id;
    state = apply(state, clockOutEvent(ctx("2026-10-27T10:00"), id));
    return { state, id };
  }

  it("a correction needs a reason and the revision it was made against, and keeps old/new values", () => {
    const { state, id } = completed();
    const s = state.sessions[id];
    const noReason = applyEvent(state, correctEvent(ctx("2026-10-27T12:00"), id, { reason: " ", expectedRevision: s.revision, startedAt: at("2026-10-26T17:00") }));
    expect(noReason.ok).toBe(false);
    const stale = applyEvent(state, correctEvent(ctx("2026-10-27T12:00"), id, { reason: "forgot", expectedRevision: s.revision - 1, startedAt: at("2026-10-26T17:00") }));
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe("revision_mismatch");

    const next = apply(state, correctEvent(ctx("2026-10-27T12:00"), id, { reason: "Started earlier", expectedRevision: s.revision, startedAt: at("2026-10-26T17:00") }));
    const fixed = next.sessions[id];
    expect(fixed.revisions).toHaveLength(1);
    expect(fixed.revisions[0].previous.startedAt).toBe(at("2026-10-26T18:00"));
    expect(fixed.revisions[0].updated.startedAt).toBe(at("2026-10-26T17:00"));
    expect(fixed.originalStartedAt).toBe(at("2026-10-26T18:00"));
    // Allocations follow the corrected times.
    expect(allocateByDay(fixed, 0).map((d) => d.netMs / H)).toEqual([7, 10]);
  });

  it("corrected breaks must stay inside the session and never overlap", () => {
    const { state, id } = completed();
    const rev = state.sessions[id].revision;
    const outside = correctEvent(ctx("2026-10-27T12:00"), id, {
      reason: "added break",
      expectedRevision: rev,
      breaks: [{ id: newId(), startedAt: at("2026-10-27T09:30"), endedAt: at("2026-10-27T10:30"), kind: "rest" }],
    });
    expect(applyEvent(state, outside).ok).toBe(false);
    const overlapping = correctEvent(ctx("2026-10-27T12:00"), id, {
      reason: "added breaks",
      expectedRevision: rev,
      breaks: [
        { id: newId(), startedAt: at("2026-10-27T02:00"), endedAt: at("2026-10-27T03:00"), kind: "rest" },
        { id: newId(), startedAt: at("2026-10-27T02:30"), endedAt: at("2026-10-27T03:30"), kind: "rest" },
      ],
    });
    const result = applyEvent(state, overlapping);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/overlap/);
  });

  it("a finished session is never silently reopened, and a running one is finished only by clock-out", () => {
    const { state, id } = completed();
    const reopen = applyEvent(state, correctEvent(ctx("2026-10-27T12:00"), id, { reason: "oops", expectedRevision: state.sessions[id].revision, endedAt: null }));
    expect(reopen.ok).toBe(false);
    const running = clockIn("2026-10-28T08:00", state);
    const finish = applyEvent(running.state, correctEvent(ctx("2026-10-28T09:00"), running.id, { reason: "x", expectedRevision: 1, endedAt: at("2026-10-28T09:00") }));
    expect(finish.ok).toBe(false);
  });

  it("a correction that would overlap another session is refused unless explicitly allowed", () => {
    const first = completed();
    let state = first.state;
    const id = first.id;
    const second = clockIn("2026-10-27T12:00", state);
    state = apply(second.state, clockOutEvent(ctx("2026-10-27T20:00"), second.id));
    const rev = state.sessions[id].revision;
    const into = correctEvent(ctx("2026-10-28T00:00"), id, { reason: "ended later", expectedRevision: rev, endedAt: at("2026-10-27T13:00") });
    const refused = applyEvent(state, into);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.conflictingSessionId).toBe(second.id);
    expect(applyEvent(state, { ...into, allowOverlap: true }).ok).toBe(true);
  });
});

describe("manual entry, trash and restore", () => {
  it("a manual session is labelled manual and may not overlap", () => {
    const { state } = clockIn("2026-10-26T18:00");
    const overlapping = manualCreateEvent(ctx("2026-10-27T09:00"), {
      startedAt: at("2026-10-26T20:00"),
      endedAt: at("2026-10-26T22:00"),
      breaks: [],
      goalSeconds: 57600,
      reportingTimeZone: DAR,
    });
    expect(applyEvent(state, overlapping).ok).toBe(false);
    const earlier = manualCreateEvent(ctx("2026-10-27T09:00"), {
      startedAt: at("2026-10-25T08:00"),
      endedAt: at("2026-10-25T16:00"),
      breaks: [],
      goalSeconds: 57600,
      reportingTimeZone: DAR,
    });
    const next = apply(state, earlier);
    expect(next.sessions[earlier.sessionId].origin).toBe("manual");
  });

  it("delete → restore → delete → purge", () => {
    const first = clockIn("2026-10-26T18:00");
    let state = first.state;
    const id = first.id;
    state = apply(state, clockOutEvent(ctx("2026-10-26T22:00"), id));
    expect(applyEvent(state, simpleEvent(ctx("2026-10-27T09:00"), "purge", id)).ok).toBe(false);
    state = apply(state, simpleEvent(ctx("2026-10-27T09:00"), "delete", id));
    expect(state.sessions[id].deletedAt).not.toBeNull();
    expect(applyEvent(state, breakStartEvent(ctx("2026-10-27T09:00"), id)).ok).toBe(false);
    state = apply(state, simpleEvent(ctx("2026-10-27T09:01"), "restore", id));
    expect(state.sessions[id].deletedAt).toBeNull();
    state = apply(state, simpleEvent(ctx("2026-10-27T09:02"), "delete", id));
    state = apply(state, simpleEvent(ctx("2026-10-27T09:03"), "purge", id));
    expect(state.sessions[id]).toBeUndefined();
  });

  it("deleting the running session frees the slot; restoring it while another runs is refused", () => {
    const first = clockIn("2026-10-26T18:00");
    let state = first.state;
    const id = first.id;
    state = apply(state, simpleEvent(ctx("2026-10-26T18:05"), "delete", id));
    const other = clockIn("2026-10-26T18:10", state);
    const restore = applyEvent(other.state, simpleEvent(ctx("2026-10-26T18:11"), "restore", id));
    expect(restore.ok).toBe(false);
  });
});

describe("schema", () => {
  it("accepts a real event and rejects unknown fields", () => {
    const e = clockInEvent({ now: Date.UTC(2026, 9, 26, 15), deviceTimeZone: DAR }, { goalSeconds: 57600, reportingTimeZone: DAR });
    expect(parseShiftEvent(e).ok).toBe(true);
    expect(parseShiftEvent({ ...e, userId: "someone-else" }).ok).toBe(false);
    expect(parseShiftEvent({ ...e, reportingTimeZone: "Mars/Olympus" }).ok).toBe(false);
    expect(parseShiftEvent({ ...e, at: 12 }).ok).toBe(false);
  });
});
