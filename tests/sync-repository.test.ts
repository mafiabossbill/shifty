import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { exportShiftData } from "@/lib/data/account";
import { commitOutcomeFor, lwwAccepts, SHIFT_RPC, SHIFT_TABLES, SupabaseShiftRepository } from "@/lib/data/shifts";
import { InMemoryShiftRepository } from "@/lib/data/shifts-memory";
import { defaultSettings } from "@/lib/shifts/profile";
import { applyEvent } from "@/lib/shifts/reducer";
import { EMPTY_STATE, type ShiftEvent } from "@/lib/shifts/types";

type Op = { method: string; args: unknown[] };
type Reply = { data?: unknown; error?: { code: string; message: string } | null; count?: number };

/** A Supabase stand-in that records every call; replies come from the test. */
function fakeSupabase(reply: { rpc?: (fn: string, args: unknown) => Reply; from?: (table: string, ops: Op[]) => Reply }) {
  const calls: { table?: string; fn?: string; args?: unknown; ops: Op[] }[] = [];
  const client = {
    rpc: async (fn: string, args?: unknown) => {
      calls.push({ fn, args, ops: [] });
      return { data: null, error: null, ...reply.rpc?.(fn, args) };
    },
    from: (table: string) => {
      const ops: Op[] = [];
      calls.push({ table, ops });
      const builder: Record<string | symbol, unknown> = new Proxy(
        {},
        {
          get: (_t, prop) => {
            if (prop === "then") {
              const result = Promise.resolve({ data: null, error: null, ...reply.from?.(table, ops) });
              return result.then.bind(result);
            }
            return (...args: unknown[]) => {
              ops.push({ method: String(prop), args });
              return builder;
            };
          },
        },
      );
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const USER = "7d9c1a52-3f1e-4c55-9a3e-2b1f0c9d8e01";
const ORG = "0b8f8a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
const ZONE = "Africa/Dar_es_Salaam";
const AT = Date.UTC(2026, 9, 20, 15);

const clockIn = (sessionId: string): ShiftEvent => ({
  id: randomUUID(),
  at: AT,
  recordedAt: AT,
  deviceTimeZone: ZONE,
  type: "clock_in",
  sessionId,
  goalSeconds: 57_600,
  reportingTimeZone: ZONE,
});

describe("Supabase shift repository", () => {
  it("calls commit_shift_event with the contract's parameters and reads its answer", async () => {
    const event = clockIn(randomUUID());
    const applied = applyEvent(EMPTY_STATE, event);
    if (!applied.ok) throw new Error("reducer");
    let answer: Reply = { data: { status: "applied", revision: 1 } };
    const { client, calls } = fakeSupabase({ rpc: () => answer });
    const repo = new SupabaseShiftRepository(client, USER, ORG);
    const input = { event, session: applied.session, sessionId: event.sessionId, expectedRevision: 0, flags: ["device_clock_ahead" as const] };

    expect(await repo.commit(input)).toEqual({ status: "applied", revision: 1 });
    expect(calls[0]).toEqual({
      fn: SHIFT_RPC.commit,
      args: { p_event: event, p_session: applied.session, p_session_id: event.sessionId, p_expected_revision: 0, p_flags: ["device_clock_ahead"] },
      ops: [],
    });
    answer = { data: { status: "duplicate" } };
    expect(await repo.commit(input)).toEqual({ status: "duplicate" });
    answer = { data: { status: "surprise" } };
    expect(await repo.commit(input)).toEqual({ status: "error", code: "unexpected_response" });
    answer = { error: { code: "40001", message: "revision_conflict" } };
    expect(await repo.commit(input)).toEqual({ status: "revision_conflict" });
  });

  it("maps database errors the way the contract says", () => {
    expect(commitOutcomeFor({ code: "40001", message: "revision_conflict" })).toEqual({ status: "revision_conflict" });
    expect(commitOutcomeFor({ code: "23505", message: "duplicate key" })).toEqual({ status: "unique_violation" });
    expect(commitOutcomeFor({ code: "23P01", message: "exclusion" })).toMatchObject({ status: "chronology" });
    expect(commitOutcomeFor({ code: "23514", message: "check" })).toMatchObject({ status: "chronology" });
    expect(commitOutcomeFor({ code: "42501", message: "denied" })).toEqual({ status: "forbidden" });
    expect(commitOutcomeFor({ code: "XX000", message: "boom" })).toEqual({ status: "error", code: "XX000" });
  });

  it("loads sessions through load_shift_state and checks committed event ids as the person", async () => {
    const { client, calls } = fakeSupabase({
      rpc: () => ({ data: [{ id: "s1" }] }),
      from: () => ({ data: [{ id: "e1" }] }),
    });
    const repo = new SupabaseShiftRepository(client, USER, ORG);
    expect(await repo.loadSessions()).toEqual([{ id: "s1" }]);
    expect(calls[0].fn).toBe(SHIFT_RPC.load);
    expect(await repo.committedEventIds(["e1", "e2", "e1"])).toEqual(new Set(["e1"]));
    expect(calls[1]).toMatchObject({ table: SHIFT_TABLES.events });
    expect(calls[1].ops).toContainEqual({ method: "eq", args: ["user_id", USER] });
    expect(calls[1].ops).toContainEqual({ method: "in", args: ["id", ["e1", "e2"]] });
  });

  it("maps profile rows to the device's shapes and pages past 1000 rows", async () => {
    const settings = defaultSettings(ZONE, 7);
    const { client } = fakeSupabase({
      from: (table, ops) => {
        if (table === SHIFT_TABLES.settings) return { data: { settings } };
        if (table === SHIFT_TABLES.places) return { data: [{ id: "p", label: "Site", latitude: "-6.8", longitude: "39.28", radius_m: 100, updated_ms: "5" }] };
        if (table === SHIFT_TABLES.ledger) {
          const from = (ops.find((o) => o.method === "range")?.args[0] as number) ?? 0;
          const size = from === 0 ? 1000 : 5;
          return { data: Array.from({ length: size }, (_, i) => ({ event_key: `k${from + i}`, rule: "r", xp: 1, source_session_id: null, awarded_ms: from + i })) };
        }
        return { data: table === SHIFT_TABLES.companion ? null : [] };
      },
    });
    const profile = await new SupabaseShiftRepository(client, USER, null).loadProfile();
    expect(profile.settings).toEqual(settings);
    expect(profile.companion).toBeNull();
    expect(profile.places).toEqual([{ id: "p", label: "Site", latitude: -6.8, longitude: 39.28, radiusM: 100, updatedAt: 5 }]);
    expect(profile.ledger).toHaveLength(1005);
    expect(profile.ledger[1004]).toEqual({ key: "k1004", rule: "r", xp: 1, sourceSessionId: null, at: 1004 });
  });

  it("saves documents and rows last-write-wins, with owner fields from the session only", async () => {
    const newer = randomUUID();
    const older = randomUUID();
    const { client, calls } = fakeSupabase({
      from: (table, ops) => {
        if (table === SHIFT_TABLES.settings && ops[0].method === "update") return { data: [] };
        if (table === SHIFT_TABLES.projects && ops[0].method === "select") {
          return { data: [{ id: newer, updated_ms: 50 }, { id: older, updated_ms: 1 }] };
        }
        return {};
      },
    });
    const repo = new SupabaseShiftRepository(client, USER, ORG);
    const settings = defaultSettings(ZONE, 10);
    const result = await repo.saveProfile({
      settings,
      projects: [
        { id: newer, name: "Stays", color: "teal", archived: false, updatedAt: 20 },
        { id: older, name: "Wins", color: "sage", archived: false, updatedAt: 20 },
      ],
      ledger: [{ key: "k", rule: "r", xp: 3, sourceSessionId: null, at: 1 }],
    });
    expect(result).toEqual({ ok: true, value: { ok: true } });

    const settingsCalls = calls.filter((c) => c.table === SHIFT_TABLES.settings);
    expect(settingsCalls[0].ops).toContainEqual({ method: "lte", args: ["updated_ms", 10] });
    expect(settingsCalls[1].ops[0]).toEqual({
      method: "upsert",
      args: [{ user_id: USER, organization_id: ORG, settings, updated_ms: 10 }, { onConflict: "user_id", ignoreDuplicates: true }],
    });
    const projectUpsert = calls.filter((c) => c.table === SHIFT_TABLES.projects)[1].ops[0];
    expect(projectUpsert.method).toBe("upsert");
    expect(projectUpsert.args[0]).toEqual([{ id: older, name: "Wins", color: "sage", archived: false, updated_ms: 20, user_id: USER, organization_id: ORG }]);
    const ledgerUpsert = calls.find((c) => c.table === SHIFT_TABLES.ledger)!.ops[0];
    expect(ledgerUpsert.args[1]).toEqual({ onConflict: "user_id,event_key", ignoreDuplicates: true });
  });

  it("refuses to write without a workspace and reports a privilege refusal as forbidden", async () => {
    const { client } = fakeSupabase({ from: () => ({ data: [] }) });
    await expect(new SupabaseShiftRepository(client, USER, null).saveProfile({ settings: defaultSettings(ZONE, 1) })).rejects.toThrow(/workspace/);
    const denied = fakeSupabase({ from: () => ({ error: { code: "42501", message: "denied" } }) });
    expect(await new SupabaseShiftRepository(denied.client, USER, ORG).saveProfile({ ledger: [{ key: "k", rule: "r", xp: 1, sourceSessionId: null, at: 1 }] })).toMatchObject({
      ok: false,
      error: "forbidden",
    });
  });

  it("last write wins accepts equal timestamps and missing rows", () => {
    expect(lwwAccepts(5, null)).toBe(true);
    expect(lwwAccepts(5, undefined)).toBe(true);
    expect(lwwAccepts(5, 5)).toBe(true);
    expect(lwwAccepts(4, 5)).toBe(false);
  });
});

describe("account export: SHIFTY data", () => {
  it("includes every session with its locations, the profile document and the event count", async () => {
    const repo = new InMemoryShiftRepository();
    const event = clockIn(randomUUID());
    const first = applyEvent(EMPTY_STATE, event);
    if (!first.ok || !first.session) throw new Error("reducer");
    const located = applyEvent(first.state, {
      id: randomUUID(),
      at: AT + 1000,
      recordedAt: AT + 1000,
      deviceTimeZone: ZONE,
      type: "location",
      sessionId: event.sessionId,
      fix: { id: randomUUID(), event: "clock_in", status: "captured", requestedAt: AT, capturedAt: AT + 900, latitude: -6.8, longitude: 39.28, accuracyM: 12, placeLabel: null },
    });
    if (!located.ok || !located.session) throw new Error("reducer");
    await repo.commit({ event, session: first.session, sessionId: event.sessionId, expectedRevision: 0, flags: [] });
    repo.sessions.set(event.sessionId, located.session);
    repo.settings = defaultSettings(ZONE, 3);

    const data = await exportShiftData(repo);
    expect(data.sessions).toEqual([located.session]);
    expect((data.sessions as { locations: { latitude: number }[] }[])[0].locations[0].latitude).toBe(-6.8);
    expect(data).toMatchObject({ settings: { updatedAt: 3 }, projects: [], ledger: [], events_committed: 1 });
  });
});
