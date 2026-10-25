import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  selfServe: true,
  signedIn: true,
  rpc: null as null | { data: unknown; error: { code: string; message: string } | null },
  calls: [] as { fn: string; args: unknown }[],
}));

vi.mock("@/lib/app-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/app-config")>();
  return {
    ...actual,
    get SELF_SERVE() {
      return state.selfServe;
    },
  };
});

vi.mock("@/lib/current-user", async () => {
  const { jsonError } = await import("@/lib/api");
  return {
    ACTIVE_ORG_COOKIE: "active_org",
    ACTIVE_ORG_COOKIE_OPTIONS: { httpOnly: true, sameSite: "lax", secure: true, path: "/" },
    apiSignedIn: async () =>
      state.signedIn
        ? {
            user: { id: "user-1", email: "new@example.test" },
            supabase: {
              rpc: async (fn: string, args: unknown) => {
                state.calls.push({ fn, args });
                return state.rpc ?? { data: "org-new", error: null };
              },
            },
          }
        : { response: jsonError(401, "Sign in to continue.") },
  };
});

const { POST } = await import("@/app/api/workspaces/route");
const post = (body: unknown) => new Request("http://test", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/workspaces", () => {
  beforeEach(() => {
    Object.assign(state, { selfServe: true, signedIn: true, rpc: null, calls: [] });
  });

  it("doesn't exist for company tenancy", async () => {
    state.selfServe = false;
    expect((await POST(post({ name: "Acme" }))).status).toBe(404);
    expect(state.calls).toHaveLength(0);
  });

  it("needs a signed-in person and a real name", async () => {
    state.signedIn = false;
    expect((await POST(post({ name: "Acme" }))).status).toBe(401);
    state.signedIn = true;
    const short = await POST(post({ name: " a " }));
    expect(short.status).toBe(400);
    expect((await short.json()).error).toBe("Workspace names are 2 to 80 characters.");
    expect((await POST(post({ name: "Acme", role: "admin" }))).status).toBe(400);
    expect(state.calls).toHaveLength(0);
  });

  it("creates the workspace with the app's timezone and currency and makes it active", async () => {
    const res = await POST(post({ name: "  Acme Ltd " }));
    expect(res.status).toBe(201);
    expect((await res.json()).data).toEqual({ id: "org-new", name: "Acme Ltd" });
    expect(state.calls[0]).toMatchObject({ fn: "create_organization", args: { p_name: "Acme Ltd" } });
    expect(res.headers.get("set-cookie")).toContain("active_org=org-new");
  });

  it("explains refusals from the database", async () => {
    state.rpc = { data: null, error: { code: "42501", message: "Confirm your email address first." } };
    expect((await POST(post({ name: "Acme" }))).status).toBe(403);
    state.rpc = { data: null, error: { code: "23514", message: "You already have the maximum number of workspaces." } };
    const capped = await POST(post({ name: "Acme" }));
    expect(capped.status).toBe(409);
    expect((await capped.json()).error).toBe("You already have the maximum number of workspaces.");
    state.rpc = { data: null, error: { code: "XX000", message: "internal detail" } };
    const broken = await POST(post({ name: "Acme" }));
    expect(broken.status).toBe(500);
    expect((await broken.json()).error).not.toContain("internal");
  });
});
