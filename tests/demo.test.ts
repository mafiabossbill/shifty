import { describe, expect, it } from "vitest";

import { buildDemo } from "@/lib/demo/seed";
import { dailyTotals, sessionFacts } from "@/lib/reports";
import { foldEvents } from "@/lib/shifts/reducer";
import { EMPTY_STATE, visibleSessions } from "@/lib/shifts/types";

describe("demo data", () => {
  it("is valid through the real reducer, deterministic and reconciles", () => {
    const now = Date.UTC(2026, 9, 25, 12);
    const a = buildDemo(now, "Africa/Dar_es_Salaam");
    const b = buildDemo(now, "Africa/Dar_es_Salaam");
    expect(a.events).toEqual(b.events);
    const { state, rejected } = foldEvents(a.events, EMPTY_STATE);
    expect(rejected).toEqual([]);
    const sessions = visibleSessions(state);
    expect(sessions.length).toBeGreaterThan(40);
    expect(sessions.some((s) => s.revisions.length > 0)).toBe(true);
    const facts = sessionFacts(sessions, now);
    const total = facts.reduce((s, f) => s + f.metrics.netMs, 0);
    expect([...dailyTotals(facts, "calendar").values()].reduce((s, d) => s + d.netMs, 0)).toBe(total);
    expect(facts.filter((f) => f.crossesMidnight).length).toBeGreaterThan(10);
  });
});
