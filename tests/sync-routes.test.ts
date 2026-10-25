import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Session } from "@/lib/current-user";
import { InMemoryShiftRepository } from "@/lib/data/shifts-memory";
import type { Role } from "@/lib/permissions";
import { defaultCompanion, defaultSettings } from "@/lib/shifts/profile";
import { applyEvent } from "@/lib/shifts/reducer";
import { EMPTY_STATE, type ShiftEvent, type ShiftSession } from "@/lib/shifts/types";
import { CLOCK_AHEAD_TOLERANCE_MS, MAX_PUSH_BATCH, type PushResult } from "@/lib/sync/contract";

const mocks = vi.hoisted(() => ({
  session: null as null | { session?: unknown; response?: Response },
  signedIn: null as null | { user?: { id: string; email: string }; response?: Response },
  signedInCalls: 0,
  repo: null as unknown,
}));

vi.mock("@/lib/current-user", async () => {
  const { jsonError } = await import("@/lib/api");
  return {
    apiSession: async () => mocks.session ?? { response: jsonError(401, "Sign in to continue.") },
    apiSignedIn: async () => {
      mocks.signedInCalls += 1;
      return mocks.signedIn ?? { response: jsonError(401, "Sign in to continue.") };
    },
  };
});

// connection() marks GET handlers as request-time; outside a Next request scope it throws.
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => {} }));

// The route tests run against the in-memory twin, never a real project.
vi.mock("@/lib/data/shifts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/shifts")>()),
  shiftRepositoryFor: () => mocks.repo,
}));

// "shift:track" (admin + member, blueprint roles) lands in permissions.ts with the database lane's migration;
// until then the map is extended here so these tests exercise the sync routes, not the merge order.
vi.mock("@/lib/permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/permissions")>();
  const withTrack = (role: "admin" | "member") =>
    (actual.ROLE_CAPABILITIES[role] as readonly string[]).includes("shift:track")
      ? actual.ROLE_CAPABILITIES[role]
      : [...actual.ROLE_CAPABILITIES[role], "shift:track"];
  return { ...actual, ROLE_CAPABILITIES: { ...actual.ROLE_CAPABILITIES, admin: withTrack("admin"), member: withTrack("member") } };
});

const { GET: status } = await import("@/app/api/sync/status/route");
const { GET: getState } = await import("@/app/api/sync/state/route");
const { POST: pushRoute } = await import("@/app/api/sync/events/route");
const { PUT: putProfile } = await import("@/app/api/sync/profile/route");

const USER_ID = "7d9c1a52-3f1e-4c55-9a3e-2b1f0c9d8e01";
const ZONE = "Africa/Dar_es_Salaam";
const HOUR = 3_600_000;

function signInAs(role: Role, repo = new InMemoryShiftRepository()) {
  const session = {
    user: { id: USER_ID, email: "asha@example.test", name: "Asha", role },
    organization: { id: "org", name: "Org", timezone: ZONE, currency: "TZS" },
    organizations: [{ id: "org", name: "Org", role }],
    supabase: {} as Session["supabase"],
    team: {} as Session["team"],
  } satisfies Session;
  mocks.session = { session };
  mocks.signedIn = { user: { id: USER_ID, email: "asha@example.test" } };
  mocks.repo = repo;
  return repo;
}

/** Event builders with device-generated ids, like the outbox sends them. */
const base = (at: number) => ({ id: randomUUID(), at, recordedAt: at, deviceTimeZone: ZONE });
const clockIn = (sessionId: string, at: number): ShiftEvent => ({ ...base(at), type: "clock_in", sessionId, goalSeconds: 16 * 3600, reportingTimeZone: ZONE });
const breakStart = (sessionId: string, breakId: string, at: number): ShiftEvent => ({ ...base(at), type: "break_start", sessionId, breakId, kind: "rest" });
const breakEnd = (sessionId: string, breakId: string, at: number): ShiftEvent => ({ ...base(at), type: "break_end", sessionId, breakId });
const clockOut = (sessionId: string, at: number): ShiftEvent => ({ ...base(at), type: "clock_out", sessionId });
const simple = (type: "delete" | "restore" | "purge", sessionId: string, at: number): ShiftEvent => ({ ...base(at), type, sessionId });

const push = async (events: unknown[]) => pushRoute(new Request("http://test/api/sync/events", { method: "POST", body: JSON.stringify({ events }) }));
async function pushOk(events: unknown[]): Promise<PushResult[]> {
  const res = await push(events);
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  return (await res.json()).data.results;
}
const put = (body: unknown) => putProfile(new Request("http://test/api/sync/profile", { method: "PUT", body: JSON.stringify(body) }));

/** A completed session already on the server (as if synced earlier). */
function seededSession(start: number, end: number): ShiftSession {
  const id = randomUUID();
  const first = applyEvent(EMPTY_STATE, clockIn(id, start));
  if (!first.ok) throw new Error("seed");
  const done = applyEvent(first.state, clockOut(id, end));
  if (!done.ok || !done.session) throw new Error("seed");
  return done.session;
}

beforeEach(() => {
  mocks.session = null;
  mocks.signedIn = null;
  mocks.signedInCalls = 0;
  mocks.repo = null;
  // Placeholder project: nothing is ever called, the repository and session are mocked.
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
});

describe("GET /api/sync/status", () => {
  it("answers 200 without touching Supabase when sync isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const before = Date.now();
    const res = await status();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { data } = await res.json();
    expect(data).toMatchObject({ configured: false, signedIn: false, userId: null, email: null });
    expect(data.serverTime).toBeGreaterThanOrEqual(before);
    expect(mocks.signedInCalls).toBe(0);
  });

  it("reports who is signed in when configured", async () => {
    signInAs("member");
    expect((await (await status()).json()).data).toMatchObject({ configured: true, signedIn: true, userId: USER_ID, email: "asha@example.test" });
    mocks.signedIn = null;
    const res = await status();
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ configured: true, signedIn: false, userId: null });
  });
});

describe("sync access", () => {
  it("answers 503 with what to set when sync isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    signInAs("admin");
    for (const res of [await getState(), await push([]), await put({})]) {
      expect(res.status).toBe(503);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.json()).toEqual({ error: "Sync isn't set up yet: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." });
    }
  });

  it("answers 401 signed out and 403 without shift:track", async () => {
    for (const res of [await getState(), await push([]), await put({})]) expect(res.status).toBe(401);
    signInAs("viewer");
    for (const res of [await getState(), await push([clockIn(randomUUID(), Date.now())]), await put({ settings: defaultSettings(ZONE, 1) })]) {
      expect(res.status).toBe(403);
    }
  });

  it("returns every session (trash included) and the profile document", async () => {
    const repo = signInAs("member", new InMemoryShiftRepository([seededSession(Date.now() - 30 * HOUR, Date.now() - 20 * HOUR)]));
    repo.settings = defaultSettings(ZONE, 5);
    const res = await getState();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { data } = await res.json();
    expect(data.sessions).toHaveLength(1);
    expect(data.profile).toMatchObject({ settings: { reportingTimeZone: ZONE }, companion: null, projects: [], ledger: [] });
    expect(typeof data.serverTime).toBe("number");
  });
});

describe("POST /api/sync/events", () => {
  it("validates the batch itself", async () => {
    signInAs("member");
    expect((await push([])).status).toBe(400);
    const tooMany = Array.from({ length: MAX_PUSH_BATCH + 1 }, () => clockIn(randomUUID(), Date.now()));
    const res = await push(tooMany);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(`Send at most ${MAX_PUSH_BATCH} events at a time.`);
    const extra = await pushRoute(new Request("http://test", { method: "POST", body: JSON.stringify({ events: [clockIn(randomUUID(), Date.now())], user_id: "x" }) }));
    expect(extra.status).toBe(400);
    expect((await extra.json()).error).toBe("Unknown field: user_id.");
    const broken = await pushRoute(new Request("http://test", { method: "POST", body: "{not json" }));
    expect(broken.status).toBe(400);
  });

  it("G: an offline clock-in → break → clock-out replays into one session with the device's times", async () => {
    const repo = signInAs("member");
    const s = randomUUID();
    const b = randomUUID();
    const t0 = Date.now() - 20 * HOUR;
    const batch = [clockIn(s, t0), breakStart(s, b, t0 + 8 * HOUR), breakEnd(s, b, t0 + 8.5 * HOUR), clockOut(s, t0 + 16 * HOUR)];
    const results = await pushOk(batch);
    expect(results.map((r) => [r.id, r.status])).toEqual(batch.map((e) => [e.id, "applied"]));
    expect(repo.sessions.size).toBe(1);
    const saved = repo.sessions.get(s)!;
    expect(saved).toMatchObject({ startedAt: t0, endedAt: t0 + 16 * HOUR, revision: 4, flags: [] });
    expect(saved.breaks).toEqual([{ id: b, startedAt: t0 + 8 * HOUR, endedAt: t0 + 8.5 * HOUR, kind: "rest" }]);
    const last = results.at(-1)!;
    expect(last.status === "applied" && last.session).toEqual(saved);

    // The same batch again (lost response, second tab): every event is a duplicate, nothing changes.
    const commits = repo.commits;
    const replay = await pushOk(batch);
    expect(replay.map((r) => r.status)).toEqual(["duplicate", "duplicate", "duplicate", "duplicate"]);
    expect(replay[0].status === "duplicate" && replay[0].session).toEqual(saved);
    expect(repo.commits).toBe(commits);
    expect(repo.sessions.get(s)).toEqual(saved);
  });

  it("J: a second device's clock-in is rejected naming the session already running", async () => {
    const repo = signInAs("member");
    const phone = randomUUID();
    const laptop = randomUUID();
    const now = Date.now();
    expect((await pushOk([clockIn(phone, now - HOUR)]))[0].status).toBe("applied");
    const [second] = await pushOk([clockIn(laptop, now - 30 * 60_000)]);
    expect(second).toMatchObject({ status: "rejected", code: "active_exists", conflictingSessionId: phone });
    expect([...repo.sessions.keys()]).toEqual([phone]);
  });

  it("J race: the one-active index refuses a clock-in committed in parallel and names the winner", async () => {
    const repo = signInAs("member");
    const winner = randomUUID();
    const now = Date.now();
    repo.beforeCommit.push(() => {
      const other = applyEvent(EMPTY_STATE, clockIn(winner, now - 2 * HOUR));
      if (other.ok && other.session) repo.sessions.set(winner, other.session);
    });
    const [result] = await pushOk([clockIn(randomUUID(), now - HOUR)]);
    expect(result).toMatchObject({ status: "rejected", code: "active_exists", message: "A session is already running.", conflictingSessionId: winner });
  });

  it("rejects a correction made against a stale revision and keeps the server version", async () => {
    const seeded = seededSession(Date.now() - 30 * HOUR, Date.now() - 20 * HOUR);
    const repo = signInAs("member", new InMemoryShiftRepository([seeded]));
    const correction: ShiftEvent = {
      ...base(Date.now()),
      type: "correct",
      sessionId: seeded.id,
      expectedRevision: seeded.revision - 1,
      reason: "Forgot to clock out",
      endedAt: seeded.endedAt! - HOUR,
    };
    const [result] = await pushOk([correction]);
    expect(result).toMatchObject({ status: "rejected", code: "revision_mismatch" });
    expect(repo.sessions.get(seeded.id)).toEqual(seeded);

    const fresh = { ...correction, id: randomUUID(), expectedRevision: seeded.revision };
    const [ok] = await pushOk([fresh]);
    expect(ok.status).toBe("applied");
    expect(repo.sessions.get(seeded.id)).toMatchObject({ endedAt: seeded.endedAt! - HOUR, revision: seeded.revision + 1 });
    expect(repo.sessions.get(seeded.id)!.revisions).toHaveLength(1);
  });

  it("reloads and re-runs the reducer when another device commits the same session in between", async () => {
    const seeded = seededSession(Date.now() - 30 * HOUR, Date.now() - 20 * HOUR);
    const repo = signInAs("member", new InMemoryShiftRepository([seeded]));
    repo.beforeCommit.push(() => {
      const other = applyEvent({ sessions: { [seeded.id]: seeded } }, { ...base(Date.now()), type: "annotate", sessionId: seeded.id, changes: { title: "Night shift" } });
      if (other.ok && other.session) repo.sessions.set(seeded.id, other.session);
    });
    const [result] = await pushOk([{ ...base(Date.now()), type: "annotate", sessionId: seeded.id, changes: { mood: 4 } }]);
    expect(result.status).toBe("applied");
    // Both changes survive: nothing was overwritten.
    expect(repo.sessions.get(seeded.id)).toMatchObject({ title: "Night shift", mood: 4, revision: seeded.revision + 2 });
  });

  it("gives up with a sentence after repeated races", async () => {
    const seeded = seededSession(Date.now() - 30 * HOUR, Date.now() - 20 * HOUR);
    const repo = signInAs("member", new InMemoryShiftRepository([seeded]));
    repo.failNext.push(...Array.from({ length: 4 }, () => ({ status: "revision_conflict" as const })));
    const [result] = await pushOk([{ ...base(Date.now()), type: "annotate", sessionId: seeded.id, changes: { mood: 2 } }]);
    expect(result).toMatchObject({ status: "rejected", code: "server" });
    expect(repo.sessions.get(seeded.id)).toEqual(seeded);
  });

  it("an invalid event doesn't block the others", async () => {
    const repo = signInAs("member");
    const s = randomUUID();
    const t0 = Date.now() - 10 * HOUR;
    const badId = randomUUID();
    const bad = { ...base(t0 + HOUR), id: badId, type: "break_start", sessionId: s, breakId: "not-a-uuid" };
    const results = await pushOk([clockIn(s, t0), bad, { nonsense: true }, clockOut(s, t0 + 2 * HOUR)]);
    expect(results.map((r) => r.status)).toEqual(["applied", "rejected", "rejected", "applied"]);
    expect(results[1]).toMatchObject({ id: badId, code: "validation" });
    expect(results[1].status === "rejected" && results[1].message).toMatch(/^Invalid event: breakId/);
    expect(results[2]).toMatchObject({ id: "#2", code: "validation" });
    expect(repo.sessions.get(s)).toMatchObject({ endedAt: t0 + 2 * HOUR });
  });

  it("flags a session whose event is dated ahead of the server clock, without changing its times", async () => {
    const repo = signInAs("member");
    const ahead = randomUUID();
    const at = Date.now() + CLOCK_AHEAD_TOLERANCE_MS + 60_000;
    const [result] = await pushOk([clockIn(ahead, at)]);
    expect(result.status === "applied" && result.session).toMatchObject({ startedAt: at, flags: ["device_clock_ahead"] });
    expect(repo.sessions.get(ahead)).toMatchObject({ startedAt: at, flags: ["device_clock_ahead"] });
    expect(repo.events.get(result.id)?.flags).toEqual(["device_clock_ahead"]);

    const onTime = randomUUID();
    await pushOk([clockOut(ahead, at + HOUR)]);
    const [ok] = await pushOk([clockIn(onTime, Date.now() + 30_000)]);
    expect(ok.status === "applied" && ok.session?.flags).toEqual([]);
  });

  it("purges a trashed session for good; replaying its events never resurrects it", async () => {
    const repo = signInAs("member");
    const s = randomUUID();
    const t0 = Date.now() - 10 * HOUR;
    const history = [clockIn(s, t0), clockOut(s, t0 + 2 * HOUR)];
    await pushOk(history);
    const notInTrash = await pushOk([simple("purge", s, Date.now())]);
    expect(notInTrash[0]).toMatchObject({ status: "rejected", code: "invalid_state" });

    const results = await pushOk([simple("delete", s, Date.now()), simple("purge", s, Date.now())]);
    expect(results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(results[1].status === "applied" && results[1].session).toBeNull();
    expect(repo.sessions.size).toBe(0);

    const replay = await pushOk(history);
    expect(replay.map((r) => r.status)).toEqual(["duplicate", "duplicate"]);
    expect(replay[0].status === "duplicate" && replay[0].session).toBeNull();
    expect(repo.sessions.size).toBe(0);
    const later = await pushOk([{ ...base(Date.now()), type: "annotate", sessionId: s, changes: { notes: "late edit" } }]);
    expect(later[0]).toMatchObject({ status: "rejected", code: "not_found" });
  });

  it("maps database refusals to rejections and keeps going", async () => {
    const repo = signInAs("member");
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    repo.failNext.push({ status: "error", code: "XX000" }, { status: "forbidden" }, { status: "chronology", message: "Breaks can't overlap." });
    const t0 = Date.now() - 10 * HOUR;
    const events = [clockIn(randomUUID(), t0), clockIn(randomUUID(), t0), clockIn(randomUUID(), t0), clockIn(randomUUID(), t0)];
    const results = await pushOk(events);
    expect(results.map((r) => (r.status === "rejected" ? r.code : r.status))).toEqual(["server", "forbidden", "chronology", "applied"]);
    expect(results[0].status === "rejected" && results[0].message).toMatch(/kept on this device/);
    // The log line carries ids and codes only.
    const line = JSON.parse(String(logged.mock.calls[0][0]));
    expect(line).toMatchObject({ level: "error", event: "sync.commit_failed", code: "XX000", event_id: events[0].id });
    expect(JSON.stringify(line)).not.toMatch(/latitude|longitude|@/);
    logged.mockRestore();
  });

  it("turns a repository failure mid-batch into a server rejection for that event only", async () => {
    const repo = signInAs("member");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const original = repo.commit.bind(repo);
    let calls = 0;
    repo.commit = async (input) => {
      calls += 1;
      if (calls === 1) throw new Error("fetch failed");
      return original(input);
    };
    const t0 = Date.now() - 10 * HOUR;
    const results = await pushOk([clockIn(randomUUID(), t0), clockIn(randomUUID(), t0)]);
    expect(results.map((r) => r.status)).toEqual(["rejected", "applied"]);
    vi.mocked(console.error).mockRestore();
  });
});

describe("PUT /api/sync/profile", () => {
  it("keeps the newest settings and companion (last write wins)", async () => {
    const repo = signInAs("member");
    expect((await put({ settings: { ...defaultSettings(ZONE, 100), clock: "12h" } })).status).toBe(200);
    const older = await put({ settings: { ...defaultSettings(ZONE, 50), clock: "24h" }, companion: defaultCompanion(10) });
    expect(older.status).toBe(200);
    expect(older.headers.get("cache-control")).toBe("no-store");
    const body = await older.json();
    expect(body.data.ok).toBe(true);
    expect(typeof body.data.serverTime).toBe("number");
    expect(repo.settings).toMatchObject({ clock: "12h", updatedAt: 100 });
    expect(repo.companion).toMatchObject({ updatedAt: 10 });
    await put({ settings: { ...defaultSettings(ZONE, 200), clock: "24h" } });
    expect(repo.settings).toMatchObject({ clock: "24h", updatedAt: 200 });
  });

  it("applies last write wins per project and place", async () => {
    const repo = signInAs("member");
    const id = randomUUID();
    await put({ projects: [{ id, name: "Clinic", color: "teal", archived: false, updatedAt: 10 }] });
    await put({ projects: [{ id, name: "Old name", color: "teal", archived: false, updatedAt: 5 }] });
    expect(repo.projects.get(id)?.name).toBe("Clinic");
    await put({ projects: [{ id, name: "Clinic B", color: "sage", archived: true, updatedAt: 11 }] });
    expect(repo.projects.get(id)).toMatchObject({ name: "Clinic B", archived: true });
    const place = { id: randomUUID(), label: "Site", latitude: -6.8, longitude: 39.28, radiusM: 100, updatedAt: 1 };
    await put({ places: [place] });
    expect((await (await getState()).json()).data.profile.places).toEqual([place]);
  });

  it("only appends to the reward ledger, activities and achievements (duplicates ignored)", async () => {
    const repo = signInAs("member");
    const entry = { key: "session_complete:abc", rule: "session_complete", xp: 20, sourceSessionId: null, at: 1 };
    await put({ ledger: [entry], achievements: [{ code: "first_clock_in", earnedAt: 1, sourceSessionId: null }], activities: [{ id: "a1", type: "week_review", key: "2026-10-19", at: 1 }] });
    await put({
      ledger: [{ ...entry, xp: 999 }, { ...entry, key: "break:abc", xp: 5 }],
      achievements: [{ code: "first_clock_in", earnedAt: 99, sourceSessionId: null }],
      activities: [{ id: "a1", type: "export", key: "x", at: 2 }],
    });
    expect([...repo.ledger.values()].map((l) => [l.key, l.xp])).toEqual([
      ["session_complete:abc", 20],
      ["break:abc", 5],
    ]);
    expect(repo.achievements.get("first_clock_in")?.earnedAt).toBe(1);
    expect(repo.activities.get("a1")?.type).toBe("week_review");
  });

  it("refuses owner fields and unknown fields anywhere in the body", async () => {
    const repo = signInAs("member");
    for (const body of [
      { user_id: USER_ID, settings: defaultSettings(ZONE, 1) },
      { organization_id: "org", ledger: [] },
      { settings: { ...defaultSettings(ZONE, 1), user_id: USER_ID } },
      { projects: [{ id: randomUUID(), name: "X", color: "teal", archived: false, updatedAt: 1, user_id: USER_ID }] },
      { ledger: [{ key: "k", rule: "r", xp: 1, sourceSessionId: null, at: 1, user_id: USER_ID }] },
    ]) {
      const res = await put(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await res.json()).error).toMatch(/^Unknown field: (user_id|organization_id)\.$/);
    }
    expect((await put({})).status).toBe(400);
    expect((await put({ settings: { ...defaultSettings(ZONE, 1), reportingTimeZone: "Mars/Olympus" } })).status).toBe(400);
    expect(repo.settings).toBeNull();
    expect(repo.ledger.size).toBe(0);
  });
});
