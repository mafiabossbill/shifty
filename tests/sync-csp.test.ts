import { afterEach, describe, expect, it, vi } from "vitest";

type Rule = { source: string; headers: { key: string; value: string }[] };

/** next.config.ts reads NEXT_PUBLIC_SUPABASE_URL when it loads, like a build does. */
async function rules(env: { url?: string; nodeEnv?: string } = {}): Promise<Rule[]> {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", env.url ?? "");
  vi.stubEnv("NODE_ENV", env.nodeEnv ?? "production");
  const config = (await import("../next.config")).default;
  return (await config.headers!()) as Rule[];
}

function csp(list: Rule[], source: string): Record<string, string[]> {
  const rule = list.filter((r) => r.source === source).at(-1)!;
  const value = rule.headers.find((h) => h.key === "Content-Security-Policy")!.value;
  return Object.fromEntries(value.split(";").map((d) => d.trim().split(/\s+/)).map(([name, ...sources]) => [name, sources]));
}

describe("page Content-Security-Policy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("locks pages to this origin, with only the inline scripts Next and the theme script need", async () => {
    const page = csp(await rules(), "/:path*");
    expect(page).toEqual({
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "blob:"],
      "font-src": ["'self'"],
      "connect-src": ["'self'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'none'"],
      "worker-src": ["'self'"],
      "manifest-src": ["'self'"],
    });
  });

  it("allows SHIFTY's Supabase project over https and wss once configured", async () => {
    const page = csp(await rules({ url: "https://abcd.supabase.co/" }), "/:path*");
    expect(page["connect-src"]).toEqual(["'self'", "https://abcd.supabase.co", "wss://abcd.supabase.co"]);
    // Plain http is only for a local project in development.
    expect(csp(await rules({ url: "http://127.0.0.1:54321" }), "/:path*")["connect-src"]).toEqual(["'self'"]);
    expect(csp(await rules({ url: "not a url" }), "/:path*")["connect-src"]).toEqual(["'self'"]);
  });

  it("adds 'unsafe-eval' only in development", async () => {
    const dev = csp(await rules({ nodeEnv: "development", url: "http://127.0.0.1:54321" }), "/:path*");
    expect(dev["script-src"]).toEqual(["'self'", "'unsafe-inline'", "'unsafe-eval'"]);
    expect(dev["connect-src"]).toEqual(["'self'", "http://127.0.0.1:54321", "ws://127.0.0.1:54321"]);
  });

  it("keeps the service worker's stricter policy (its rule comes last, so it wins)", async () => {
    const list = await rules();
    expect(list.at(-1)!.source).toBe("/sw.js");
    expect(csp(list, "/sw.js")).toEqual({ "default-src": ["'self'"], "script-src": ["'self'"] });
  });
});
