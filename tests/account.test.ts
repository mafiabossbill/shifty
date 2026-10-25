import { beforeEach, describe, expect, it, vi } from "vitest";

/** A Supabase query builder stand-in: every method chains; awaiting it resolves to { data }. */
function query(data: unknown) {
  const result = Promise.resolve({ data, error: null });
  const builder: Record<string, unknown> = new Proxy(
    {},
    { get: (_t, prop) => (prop === "then" ? result.then.bind(result) : prop === "maybeSingle" ? () => result : () => builder) },
  );
  return builder;
}

const state = vi.hoisted(() => ({
  signedIn: true,
  rpcError: null as null | { code: string; message: string },
  calls: [] as { fn: string; args?: unknown }[],
  signedOut: false,
}));

vi.mock("@/lib/current-user", async () => {
  const { jsonError } = await import("@/lib/api");
  const tables: Record<string, unknown> = {
    profiles: { full_name: "Asha", created_at: "2026-01-01T00:00:00Z" },
    organization_members: [{ role: "admin", organizations: { name: "Acme" } }],
  };
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { email: "asha@example.test", created_at: "2026-01-01T00:00:00Z", user_metadata: { terms_version: "2026-01-01" } } } }),
      signOut: async () => {
        state.signedOut = true;
      },
    },
    from: (table: string) => query(tables[table] ?? []),
    rpc: async (fn: string, args?: unknown) => {
      state.calls.push({ fn, args });
      if (fn === "account_deletion_preview") return { data: [{ organization_id: "o1", organization_name: "Acme", outcome: "kept" }], error: null };
      return { data: null, error: state.rpcError };
    },
  };
  return {
    ACTIVE_ORG_COOKIE: "active_org",
    apiSignedIn: async () =>
      state.signedIn ? { user: { id: "user-1", email: "asha@example.test" }, supabase } : { response: jsonError(401, "Sign in to continue.") },
  };
});

const { GET: exportData } = await import("@/app/api/account/export/route");
const { GET: impact, DELETE: remove } = await import("@/app/api/account/route");
const del = (body: unknown) => new Request("http://test", { method: "DELETE", body: JSON.stringify(body) });

describe("account self-service", () => {
  beforeEach(() => {
    Object.assign(state, { signedIn: true, rpcError: null, calls: [], signedOut: false });
  });

  it("needs a signed-in person", async () => {
    state.signedIn = false;
    expect((await exportData()).status).toBe(401);
    expect((await impact()).status).toBe(401);
    expect((await remove(del({ confirm_email: "x" }))).status).toBe(401);
  });

  it("exports the person's data as a download, including their consent record", async () => {
    const res = await exportData();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename=".+-my-data-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.account).toMatchObject({ id: "user-1", email: "asha@example.test", metadata: { terms_version: "2026-01-01" } });
    expect(body.workspaces).toHaveLength(1);
  });

  it("previews what deletion does per workspace", async () => {
    const res = await impact();
    expect((await res.json()).data).toEqual([{ organization_id: "o1", organization_name: "Acme", outcome: "kept" }]);
  });

  it("deletes the account with the typed email, signs out and clears the workspace cookie", async () => {
    expect((await remove(del({}))).status).toBe(400);
    const res = await remove(del({ confirm_email: " Asha@Example.test " }));
    expect(res.status).toBe(200);
    expect(state.calls.at(-1)).toEqual({ fn: "delete_own_account", args: { p_confirm_email: "Asha@Example.test" } });
    expect(state.signedOut).toBe(true);
    expect(res.headers.get("set-cookie")).toMatch(/active_org=;/);
  });

  it("passes the database's refusal through as a sentence", async () => {
    state.rpcError = { code: "23514", message: "You're the last admin of a workspace with other people in it. Make someone else an admin first." };
    const res = await remove(del({ confirm_email: "asha@example.test" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/last admin/);
    expect(state.signedOut).toBe(false);
  });
});
