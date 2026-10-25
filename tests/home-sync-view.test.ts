import { describe, expect, it } from "vitest";

import { describeAttention, discardConsequence, lastSyncedLine, syncExplanation, syncPill } from "@/lib/home/sync-view";
import type { StoredEvent } from "@/lib/store/persistence";
import type { SyncView } from "@/lib/store/store";

const ZONE = "Africa/Dar_es_Salaam";
const MON_18 = Date.UTC(2026, 9, 26, 15, 0, 0);

function sync(over: Partial<SyncView> = {}): SyncView {
  return {
    mode: "account",
    phase: "idle",
    message: null,
    pending: 0,
    attention: [],
    lastSyncedAt: null,
    email: "bill@example.com",
    ...over,
  };
}

const refused: StoredEvent = {
  event: {
    id: "ev1",
    at: MON_18,
    recordedAt: MON_18,
    deviceTimeZone: ZONE,
    type: "clock_in",
    sessionId: "s1",
    goalSeconds: 57600,
    reportingTimeZone: ZONE,
  },
  seq: 1,
  status: "rejected",
  holdUntil: null,
  error: { code: "active_exists", message: "A session is already running." },
  attempts: 2,
};

describe("syncPill", () => {
  it.each([
    [{ mode: "device" as const }, "local", "On this device"],
    [{ mode: "unconfigured" as const }, "local", "On this device"],
    [{ mode: "signed_out" as const }, "local", "Sign in to sync"],
    [{ mode: "attach_pending" as const }, "local", "Ready to upload"],
    [{ mode: "foreign_data" as const }, "needs_attention", "Needs attention"],
    [{ phase: "syncing" as const, pending: 3 }, "syncing", "Syncing"],
    [{ phase: "idle" as const, pending: 0 }, "synced", "Synced"],
    [{ phase: "idle" as const, pending: 2 }, "local", "Local · 2"],
    [{ phase: "offline" as const, pending: 2 }, "local", "Offline · saved here"],
    [{ phase: "error" as const, pending: 0 }, "local", "Sync paused"],
    [{ attention: [refused] }, "needs_attention", "Needs attention"],
    [{ mode: "device" as const, attention: [refused] }, "needs_attention", "Needs attention"],
  ])("%o → %s %s", (over, state, label) => {
    expect(syncPill(sync(over))).toEqual({ state, label });
  });
});

describe("syncExplanation", () => {
  it("is plain about device mode and offers no sync", () => {
    const e = syncExplanation(sync({ mode: "device" }));
    expect(e.canSync).toBe(false);
    expect(e.body).toMatch(/this browser on this device/);
  });
  it("names the account when signed in", () => {
    expect(syncExplanation(sync()).body).toContain("bill@example.com");
    expect(syncExplanation(sync({ mode: "attach_pending" })).body).toContain("signed in as bill@example.com");
  });
  it("counts pending changes", () => {
    expect(syncExplanation(sync({ pending: 1 })).body).toMatch(/^1 change saved/);
  });
});

describe("describeAttention", () => {
  it("says what was refused, when, and why", () => {
    const item = describeAttention(refused, {});
    expect(item.sentence).toBe("Clock-in on Mon 18:00 wasn't accepted: A session is already running.");
    expect(item.dropsSession).toBe(true);
    expect(item.evidence.find((e) => e.label === "Error")?.value).toBe("active_exists");
    expect(item.evidence.find((e) => e.label === "Event")?.value).toBe("clock_in");
  });
  it("adds a full stop and falls back when the error has no message", () => {
    const e: StoredEvent = {
      ...refused,
      event: {
        id: "ev2",
        at: MON_18,
        recordedAt: MON_18,
        deviceTimeZone: ZONE,
        type: "clock_out",
        sessionId: "s1",
      },
      error: null,
    };
    const item = describeAttention(e, {});
    expect(item.sentence).toBe("Clock-out on Mon 18:00 wasn't accepted: The server refused it.");
    expect(item.dropsSession).toBe(false);
    expect(discardConsequence(item)).toMatch(/Your account keeps its own version/);
  });
});

describe("lastSyncedLine", () => {
  it("shows time today, weekday otherwise", () => {
    expect(lastSyncedLine(null, MON_18, ZONE)).toBe("Never synced");
    expect(lastSyncedLine(MON_18, MON_18 + 60_000, ZONE)).toBe("Last synced 18:00");
    expect(lastSyncedLine(MON_18, MON_18 + 86_400_000, ZONE)).toBe("Last synced Mon 18:00");
  });
});
