import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ created: 0, claims: null as unknown, throws: false }));

// Stands in for Supabase Auth: nothing leaves the test.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => {
    auth.created += 1;
    return {
      auth: {
        getClaims: async () => {
          if (auth.throws) throw new Error("network down");
          return { data: auth.claims ? { claims: auth.claims } : null, error: null };
        },
      },
    };
  },
}));

const { proxy } = await import("@/proxy");
const request = (path: string) => new NextRequest(new URL(path, "https://shifty.test"));

describe("proxy", () => {
  beforeEach(() => {
    Object.assign(auth, { created: 0, claims: null, throws: false });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
  });

  it("passes everything through in device mode, without creating a Supabase client", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    for (const path of ["/", "/sessions/abc", "/dashboard", "/api/sync/state", "/login"]) {
      const res = await proxy(request(path));
      expect(res.headers.get("location"), path).toBeNull();
      expect(res.headers.get("x-middleware-next"), path).toBe("1");
    }
    expect(auth.created).toBe(0);
  });

  it("serves the tracking shell signed out and leaves /api/* to answer 401 itself", async () => {
    for (const path of ["/", "/sessions", "/sessions/new", "/insights", "/companion", "/settings/privacy", "/api/sync/state", "/login", "/privacy"]) {
      const res = await proxy(request(path));
      expect(res.headers.get("location"), path).toBeNull();
    }
    expect(auth.created).toBeGreaterThan(0);
  });

  it("still sends signed-out visitors of account-only pages to /login with ?next=", async () => {
    const res = await proxy(request("/dashboard?tab=1"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard?tab=1");
    auth.claims = { sub: "user-1" };
    expect((await proxy(request("/dashboard"))).headers.get("location")).toBeNull();
  });

  it("lets the request through when Supabase Auth is unreachable", async () => {
    auth.throws = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await proxy(request("/dashboard"));
    expect(res.headers.get("location")).toBeNull();
    vi.mocked(console.error).mockRestore();
  });
});
