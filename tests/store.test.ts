import { describe, expect, it } from "vitest";

import type { CaptureResult } from "@/lib/geo/capture";
import { applyEvent } from "@/lib/shifts/reducer";
import { EMPTY_STATE, type ShiftEvent, type ShiftState } from "@/lib/shifts/types";
import { MemoryPersistence } from "@/lib/store/persistence";
import { ShiftActionError, ShiftStore } from "@/lib/store/store";
import type { ProfileDocument, PushResult } from "@/lib/sync/contract";
import { SyncHttpError, type SyncTransport } from "@/lib/sync/transport";
import { sessionMetrics } from "@/lib/time/allocate";

const H = 3_600_000;
const DAR = "Africa/Dar_es_Salaam";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class FakeServer {
  state: ShiftState = EMPTY_STATE;
  seen = new Set<string>();
  profile: ProfileDocument = { settings: null, companion: null, projects: [], places: [], activities: [], ledger: [], achievements: [] };
  signedIn = true;
  pushes = 0;

  transport(online: { value: boolean }, now: () => number): SyncTransport {
    const guard = () => {
      if (!online.value) throw new TypeError("Failed to fetch");
    };
    return {
      status: async () => {
        guard();
        return { configured: true, signedIn: this.signedIn, userId: this.signedIn ? "u1" : null, email: "bill@example.com", serverTime: now() };
      },
      pull: async () => {
        guard();
        if (!this.signedIn) throw new SyncHttpError(401, "Sign in");
        return { sessions: Object.values(this.state.sessions), profile: this.profile, serverTime: now() };
      },
      push: async (events: ShiftEvent[]) => {
        guard();
        this.pushes++;
        const results: PushResult[] = events.map((e) => {
          if (this.seen.has(e.id)) return { id: e.id, status: "duplicate", session: this.state.sessions[e.sessionId] ?? null };
          const r = applyEvent(this.state, e);
          if (!r.ok) return { id: e.id, status: "rejected", code: r.error.code, message: r.error.message, conflictingSessionId: r.error.conflictingSessionId };
          this.seen.add(e.id);
          this.state = r.state;
          return { id: e.id, status: "applied", session: r.session };
        });
        return { results, serverTime: now() };
      },
      putProfile: async (body) => {
        guard();
        this.profile = { ...this.profile, ...body } as ProfileDocument;
        return { serverTime: now() };
      },
    };
  }
}

function device(opts: { server?: FakeServer; persistence?: MemoryPersistence; online?: { value: boolean }; clock?: { t: number }; locate?: () => Promise<CaptureResult> } = {}) {
  const clock = opts.clock ?? { t: Date.UTC(2026, 9, 26, 15, 0) };
  const online = opts.online ?? { value: true };
  const persistence = opts.persistence ?? new MemoryPersistence();
  const denied = async (): Promise<CaptureResult> => ({ event: "clock_in", status: "denied", requestedAt: clock.t, capturedAt: null, latitude: null, longitude: null, accuracyM: null, placeLabel: null });
  const store = new ShiftStore({
    persistence,
    transport: opts.server ? opts.server.transport(online, () => clock.t) : null,
    clock: () => clock.t,
    deviceTimeZone: () => DAR,
    online: () => online.value,
    undoMs: 30,
    locate: opts.locate ?? denied,
  });
  return { store, clock, online, persistence };
}

describe("device mode", () => {
  it("works with no server at all and survives a restart (H)", async () => {
    const d = device();
    await d.store.init();
    const s = await d.store.clockIn();
    await sleep(5);
    d.clock.t += 5 * H;
    const again = new ShiftStore({ persistence: d.persistence, transport: null, clock: () => d.clock.t, deviceTimeZone: () => DAR });
    await again.init();
    const view = again.getSnapshot();
    expect(view.active?.id).toBe(s.id);
    expect(sessionMetrics(view.active!, again.now()).netMs).toBe(5 * H);
    expect(view.sync.mode).toBe("device");
    expect(view.sessionSync[s.id]).toBe("local");
  });

  it("I: denied location still clocks in, truthfully recorded", async () => {
    const d = device();
    await d.store.init();
    const s = await d.store.clockIn();
    await sleep(5);
    const view = d.store.getSnapshot();
    expect(view.active?.startedAt).toBe(s.startedAt);
    expect(view.active?.locations[0]).toMatchObject({ status: "denied", latitude: null });
  });

  it("J: a second clock-in while one runs is refused and nothing is stored", async () => {
    const d = device();
    await d.store.init();
    await d.store.clockIn();
    await expect(d.store.clockIn()).rejects.toBeInstanceOf(ShiftActionError);
    expect(d.store.getSnapshot().sessions).toHaveLength(1);
  });

  it("clock-out can be undone inside the window and not after", async () => {
    const d = device();
    await d.store.init();
    await d.store.clockIn();
    d.clock.t += H;
    await d.store.clockOut();
    expect(d.store.getSnapshot().active).toBeNull();
    expect(await d.store.undoClockOut()).toBe(true);
    expect(d.store.getSnapshot().active).not.toBeNull();
    await d.store.clockOut();
    d.clock.t += 1_000;
    expect(await d.store.undoClockOut()).toBe(false);
  });

  it("the opt-in safety limit clocks out at the exact limit instant", async () => {
    const d = device();
    await d.store.init();
    await d.store.updateSettings({ safetyLimitHours: 20 });
    const s = await d.store.clockIn();
    d.clock.t += 23 * H;
    expect(await d.store.checkSafetyLimit()).toBe(true);
    const done = d.store.getSnapshot().state.sessions[s.id];
    expect(done.endedAt).toBe(s.startedAt + 20 * H);
    expect(await d.store.checkSafetyLimit()).toBe(false);
  });

  it("no safety limit by default: a 20h session keeps running", async () => {
    const d = device();
    await d.store.init();
    await d.store.clockIn();
    d.clock.t += 20 * H;
    expect(await d.store.checkSafetyLimit()).toBe(false);
    expect(d.store.getSnapshot().active).not.toBeNull();
  });
});

describe("G: offline, then sync", () => {
  it("clock in offline, close, reopen offline, clock out, come online: exactly one session, nothing lost", async () => {
    const server = new FakeServer();
    const online = { value: false };
    online.value = true;
    const a = device({ server, online });
    await a.store.init();
    await a.store.syncNow(); // signed in once on this device
    online.value = false;
    const s = await a.store.clockIn();
    await a.store.syncNow();
    expect(a.store.getSnapshot().sync.phase).toBe("offline");

    // App killed; reopened hours later, still offline.
    a.clock.t += 6 * H;
    const b = device({ server, online, persistence: a.persistence, clock: a.clock });
    await b.store.init();
    expect(b.store.getSnapshot().active?.id).toBe(s.id);
    await b.store.startBreak();
    a.clock.t += 30 * 60_000;
    await b.store.endBreak();
    a.clock.t += 2 * H;
    await b.store.clockOut();
    expect(b.store.getSnapshot().sync.pending).toBeGreaterThan(0);

    online.value = true;
    a.clock.t += 1_000; // undo window passes
    await b.store.syncNow();
    const view = b.store.getSnapshot();
    expect(Object.keys(server.state.sessions)).toEqual([s.id]);
    const onServer = server.state.sessions[s.id];
    expect(sessionMetrics(onServer, 0).netMs).toBe(8 * H);
    expect(view.sync.pending).toBe(0);
    expect(view.sync.mode).toBe("account");
    expect(view.sessionSync[s.id]).toBeUndefined();
    expect(view.state.sessions[s.id]).toEqual(onServer);
  });

  it("an app killed mid-send resends safely (server answers duplicate)", async () => {
    const server = new FakeServer();
    const a = device({ server });
    await a.store.init();
    await a.store.syncNow();
    const s = await a.store.clockIn();
    await sleep(5);
    const stored = (await a.persistence.load()).events;
    // The server applied the batch but the app died before hearing back: events stay 'syncing' on disk.
    for (const e of stored) {
      const r = applyEvent(server.state, e.event);
      if (r.ok) server.state = r.state;
      server.seen.add(e.event.id);
      await a.persistence.putEvent({ ...e, status: "syncing" });
    }
    const b = device({ server, persistence: a.persistence, clock: a.clock });
    await b.store.init();
    expect(b.store.getSnapshot().sync.pending).toBe(stored.length);
    await b.store.syncNow();
    expect(b.store.getSnapshot().sync.pending).toBe(0);
    expect(b.store.getSnapshot().sync.attention).toHaveLength(0);
    expect(Object.keys(server.state.sessions)).toEqual([s.id]);
  });

  it("J across devices: the second device's clock-in needs attention, never overwrites", async () => {
    const server = new FakeServer();
    const online = { value: false };
    const clock = { t: Date.UTC(2026, 9, 26, 15) };
    const a = device({ server, online, clock });
    const b = device({ server, online, clock });
    online.value = true;
    await a.store.init();
    await b.store.init();
    await a.store.syncNow();
    await b.store.syncNow();
    online.value = false;
    const sa = await a.store.clockIn();
    clock.t += 60_000;
    const sb = await b.store.clockIn();
    online.value = true;
    await a.store.syncNow();
    await b.store.syncNow();
    expect(Object.keys(server.state.sessions)).toEqual([sa.id]);
    const view = b.store.getSnapshot();
    const refused = view.sync.attention.find((e) => e.event.type === "clock_in")!;
    expect(refused.error?.code).toBe("active_exists");
    expect(refused.error && "conflictingSessionId" in refused.error ? refused.error.conflictingSessionId : null).toBe(sa.id);
    expect(view.sessionSync[sb.id]).toBe("attention");
    // The person discards B's copy: B now shows A's running session from the server.
    await b.store.discard(refused.event.id);
    await b.store.syncNow();
    expect(b.store.getSnapshot().active?.id).toBe(sa.id);
    expect(b.store.getSnapshot().sync.attention).toHaveLength(0);
  });

  it("signed in with device data asks before uploading it", async () => {
    const server = new FakeServer();
    const d = device({ server, online: { value: true } });
    await d.store.init();
    // Device used before signing in: pretend sign-in happened after.
    server.signedIn = false;
    await d.store.clockIn();
    await d.store.syncNow();
    expect(d.store.getSnapshot().sync.mode).toBe("device");
    server.signedIn = true;
    await d.store.syncNow();
    expect(d.store.getSnapshot().sync.mode).toBe("attach_pending");
    expect(Object.keys(server.state.sessions)).toHaveLength(0);
    await d.store.attachToAccount();
    expect(Object.keys(server.state.sessions)).toHaveLength(1);
    expect(d.store.getSnapshot().sync.mode).toBe("account");
  });

  it("the clock-out isn't sent during its undo window", async () => {
    const server = new FakeServer();
    const d = device({ server });
    await d.store.init();
    await d.store.syncNow();
    await d.store.clockIn();
    await d.store.syncNow();
    d.clock.t += H;
    await d.store.clockOut();
    await d.store.syncNow();
    expect(Object.values(server.state.sessions)[0].endedAt).toBeNull();
    await d.store.undoClockOut();
    await d.store.syncNow();
    expect(Object.values(server.state.sessions)[0].endedAt).toBeNull();
    expect(d.store.getSnapshot().active).not.toBeNull();
  });

  it("measures the server offset and uses it as now (L: device clock adjustment)", async () => {
    const server = new FakeServer();
    const clock = { t: Date.UTC(2026, 9, 26, 15) };
    const skewedServer: SyncTransport = { ...server.transport({ value: true }, () => clock.t + 10 * 60_000) };
    const store = new ShiftStore({ persistence: new MemoryPersistence(), transport: skewedServer, clock: () => clock.t, deviceTimeZone: () => DAR, locate: async () => ({ event: "clock_in", status: "off", requestedAt: 0, capturedAt: null, latitude: null, longitude: null, accuracyM: null, placeLabel: null }) });
    await store.init();
    await store.syncNow();
    expect(store.getSnapshot().serverOffsetMs).toBe(10 * 60_000);
    const s = await store.clockIn();
    expect(s.startedAt).toBe(clock.t + 10 * 60_000);
  });
});
