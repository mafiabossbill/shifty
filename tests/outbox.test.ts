import { describe, expect, it, vi } from "vitest";

import { MemoryOutboxStore, backoffMs, enqueue, flush } from "@/lib/offline/outbox";

const t0 = new Date("2026-10-22T08:00:00Z");

describe("offline outbox", () => {
  it("keeps one item per client_id and sends oldest first", async () => {
    const store = new MemoryOutboxStore();
    await enqueue(store, { url: "/api/a", method: "POST", body: { client_id: "c1", n: 1 } }, t0);
    await enqueue(store, { url: "/api/a", method: "POST", body: { client_id: "c1", n: 1 } }, t0);
    await enqueue(store, { url: "/api/b", method: "POST", body: { n: 2 } }, new Date(t0.getTime() + 1000));
    expect(await store.all()).toHaveLength(2);
    const calls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (url) => {
      calls.push(String(url));
      return Response.json({ data: {} }, { status: 201 });
    });
    const result = await flush(store, { fetchImpl, now: new Date(t0.getTime() + 5000) });
    expect(calls).toEqual(["/api/a", "/api/b"]);
    expect(result.sent).toHaveLength(2);
    expect(await store.all()).toHaveLength(0);
  });

  it("retries transport failures and 5xx with backoff, drops conflicts and permanent failures", async () => {
    const store = new MemoryOutboxStore();
    for (const id of ["net", "server", "conflict", "invalid"]) await enqueue(store, { url: `/api/${id}`, method: "POST", body: { client_id: id } }, t0);
    const fetchImpl = vi.fn<typeof fetch>(async (url) => {
      const id = String(url).split("/").at(-1);
      if (id === "net") throw new TypeError("Failed to fetch");
      if (id === "server") return Response.json({ error: "Down" }, { status: 503 });
      if (id === "conflict") return Response.json({ error: "Approved already." }, { status: 409 });
      return Response.json({ error: "Give it a name." }, { status: 400 });
    });
    const result = await flush(store, { fetchImpl, now: t0 });
    expect(result.conflicts).toEqual([{ id: "conflict", message: "Approved already." }]);
    expect(result.failed).toEqual([{ id: "invalid", message: "Give it a name." }]);
    expect(result.waiting).toBe(2);
    const left = await store.all();
    expect(left.map((i) => i.id).sort()).toEqual(["net", "server"]);
    expect(left.every((i) => i.attempts === 1 && i.nextAttemptAt === new Date(t0.getTime() + 1000).toISOString())).toBe(true);
    // Not due yet: nothing is sent.
    const early = await flush(store, { fetchImpl, now: new Date(t0.getTime() + 500) });
    expect(early.waiting).toBe(2);
  });

  it("caps backoff at five minutes", () => {
    expect(backoffMs(1)).toBe(1000);
    expect(backoffMs(4)).toBe(8000);
    expect(backoffMs(30)).toBe(300_000);
  });
});
