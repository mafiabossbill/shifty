/**
 * Runs public/sw.js in a minimal fake ServiceWorkerGlobalScope (node:vm) with stubbed
 * caches and fetch, and checks what it intercepts and what it stores.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const ORIGIN = "https://shifty.test";
const source = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");

type Handler = (event: unknown) => void;

class FakeCache {
  entries = new Map<string, Response>();
  private key(input: unknown): string {
    const url = typeof input === "string" ? input : (input as { url: string }).url;
    return new URL(url, ORIGIN).href;
  }
  async match(input: unknown) {
    const hit = this.entries.get(this.key(input));
    return hit ? hit.clone() : undefined;
  }
  async put(input: unknown, response: Response) {
    this.entries.set(this.key(input), response);
  }
  async delete(input: unknown) {
    return this.entries.delete(this.key(input));
  }
  async keys() {
    return [...this.entries.keys()].map((url) => ({ url }));
  }
  has(pathname: string) {
    return this.entries.has(new URL(pathname, ORIGIN).href);
  }
}

class FakeCacheStorage {
  stores = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new FakeCache());
    return this.stores.get(name)!;
  }
  async keys() {
    return [...this.stores.keys()];
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
}

/** A same-origin "basic" response like the browser's (Node builds "default" ones). */
function basic(body: string, init: ResponseInit & { redirected?: boolean } = {}) {
  const response = new Response(body, { status: init.status ?? 200, headers: init.headers ?? { "Content-Type": "text/html" } });
  Object.defineProperty(response, "type", { value: "basic" });
  Object.defineProperty(response, "redirected", { value: Boolean(init.redirected) });
  return response;
}

type FetchImpl = (input: unknown, init?: unknown) => Promise<Response>;

function requestUrl(input: unknown): URL {
  return new URL(typeof input === "string" ? input : (input as { url: string }).url, ORIGIN);
}

function loadWorker(options: { fetch?: FetchImpl; instantTimers?: boolean } = {}) {
  const handlers = new Map<string, Handler[]>();
  const caches = new FakeCacheStorage();
  const fetch = vi.fn<FetchImpl>(options.fetch ?? (async () => basic("ok")));
  const self = {
    location: { origin: ORIGIN, href: `${ORIGIN}/sw.js` },
    addEventListener: (type: string, handler: Handler) => handlers.set(type, [...(handlers.get(type) ?? []), handler]),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined), matchAll: vi.fn(async () => []), openWindow: vi.fn(async () => null) },
    registration: { showNotification: vi.fn(async () => undefined) },
  };
  class SWRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(typeof input === "string" ? new URL(input, ORIGIN).href : input, init);
    }
  }
  const context = vm.createContext({
    self,
    caches,
    fetch,
    Request: SWRequest,
    Response,
    AbortController,
    URL,
    console: { info: () => undefined, log: () => undefined, warn: () => undefined, error: () => undefined },
    setTimeout: options.instantTimers ? (fn: () => void) => setImmediate(fn) : setTimeout,
    clearTimeout: options.instantTimers ? () => undefined : clearTimeout,
  });
  vm.runInContext(source, context, { filename: "sw.js" });

  async function dispatch(type: string, init: Record<string, unknown> = {}) {
    const waits: Promise<unknown>[] = [];
    let responded: Promise<Response> | undefined;
    const event = {
      ...init,
      waitUntil: (p: Promise<unknown>) => waits.push(p),
      respondWith: (p: Promise<Response>) => {
        responded = p;
      },
    };
    for (const handler of handlers.get(type) ?? []) handler(event);
    const response = responded ? await responded : undefined;
    // waitUntil may be called while the response promise settles.
    while (waits.length) await waits.shift();
    return { response, intercepted: responded !== undefined };
  }

  function fetchEvent(url: string, init: { mode?: string; method?: string } = {}) {
    return dispatch("fetch", { request: { url: new URL(url, ORIGIN).href, method: init.method ?? "GET", mode: init.mode ?? "no-cors" } });
  }

  return { handlers, caches, fetch, self, dispatch, fetchEvent };
}

const shellHtml = (route: string) => `<html><script src="/_next/static/chunks/app-${route.replaceAll("/", "_")}.js"></script></html>`;

describe("service worker: install and activate", () => {
  it("precaches shell routes cookie-free, tolerates missing routes, and pulls referenced chunks", async () => {
    const sw = loadWorker({
      fetch: async (input, init) => {
        const url = requestUrl(input);
        if (url.pathname === "/sessions/trash") return basic("not found", { status: 404 });
        if (url.pathname === "/companion") throw new TypeError("network down");
        if (url.pathname.startsWith("/_next/static/")) return basic("js", { headers: { "Content-Type": "text/javascript" } });
        void init;
        return basic(shellHtml(url.pathname));
      },
    });
    await sw.dispatch("install");

    const shell = await sw.caches.open("shifty-shell-v2");
    for (const route of ["/", "/sessions", "/sessions/view", "/settings/account", "/offline.html", "/manifest.webmanifest", "/icons/icon-192.png"]) {
      expect(shell.has(route), route).toBe(true);
    }
    expect(shell.has("/sessions/trash")).toBe(false);
    expect(shell.has("/companion")).toBe(false);

    const statics = await sw.caches.open("shifty-static-v2");
    expect(statics.has("/_next/static/chunks/app-_sessions_view.js")).toBe(true);

    // Shell HTML is fetched without cookies, so a signed-in render is never stored.
    const shellRequests = sw.fetch.mock.calls.map(([input]) => input).filter((input): input is Request => input instanceof Request && requestUrl(input).pathname === "/sessions");
    expect(shellRequests.length).toBeGreaterThan(0);
    for (const request of shellRequests) expect(request.credentials).toBe("omit");

    // A new worker waits for the page's SKIP_WAITING instead of taking over mid-session.
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  });

  it("does not cache redirected or non-200 shell responses", async () => {
    const sw = loadWorker({
      fetch: async (input) => (requestUrl(input).pathname === "/settings" ? basic("login", { redirected: true }) : basic("<html></html>")),
    });
    await sw.dispatch("install");
    const shell = await sw.caches.open("shifty-shell-v2");
    expect(shell.has("/settings")).toBe(false);
    expect(shell.has("/")).toBe(true);
  });

  it("activate deletes old versioned caches, keeps current and foreign ones, claims clients", async () => {
    const sw = loadWorker();
    for (const name of ["shifty-shell-v1", "shifty-static-v1", "app-offline-v1", "shifty-shell-v2", "shifty-static-v2", "someone-else"]) await sw.caches.open(name);
    await sw.dispatch("activate");
    expect((await sw.caches.keys()).sort()).toEqual(["shifty-shell-v2", "shifty-static-v2", "someone-else"]);
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });

  it("skips waiting only when the page asks", async () => {
    const sw = loadWorker();
    await sw.dispatch("message", { data: { type: "OTHER" } });
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
    await sw.dispatch("message", { data: { type: "SKIP_WAITING" } });
    expect(sw.self.skipWaiting).toHaveBeenCalledTimes(1);
  });
});

describe("service worker: what it never intercepts", () => {
  it.each([
    ["/api/sync/events", "navigate", "GET"],
    ["/api/health", "cors", "GET"],
    ["/api", "cors", "GET"],
    ["/auth/callback?code=x", "navigate", "GET"],
    ["https://abc.supabase.co/rest/v1/sessions", "cors", "GET"],
    ["https://fonts.example.com/font.woff2", "no-cors", "GET"],
    ["https://other.example.com/sessions", "navigate", "GET"],
    ["https://cdn.example.com/_next/static/chunks/a.js", "no-cors", "GET"],
    ["/", "navigate", "POST"],
    ["/_next/static/chunks/a.js", "no-cors", "POST"],
    ["/sessions?_rsc=abc", "cors", "GET"],
  ])("%s (%s %s) goes straight to the network", async (url, mode, method) => {
    const sw = loadWorker();
    const { intercepted } = await sw.fetchEvent(url, { mode, method });
    expect(intercepted).toBe(false);
    expect(sw.fetch).not.toHaveBeenCalled();
  });
});

describe("service worker: navigations", () => {
  async function installed(fetchImpl: FetchImpl, options: { instantTimers?: boolean } = {}) {
    let impl: FetchImpl = async (input) => basic(`cached ${requestUrl(input).pathname}`);
    const sw = loadWorker({ fetch: (input, init) => impl(input, init), ...options });
    await sw.dispatch("install");
    sw.fetch.mockClear();
    impl = fetchImpl;
    return sw;
  }

  it("offline: session detail opens from the cached /sessions/view, keyed without the query", async () => {
    const sw = await installed(async () => {
      throw new TypeError("offline");
    });
    const { response, intercepted } = await sw.fetchEvent("/sessions/view?id=7f3c", { mode: "navigate" });
    expect(intercepted).toBe(true);
    expect(await response!.text()).toBe("cached /sessions/view");
  });

  it("offline: a trailing slash still finds the shell", async () => {
    const sw = await installed(async () => {
      throw new TypeError("offline");
    });
    const { response } = await sw.fetchEvent("/insights/", { mode: "navigate" });
    expect(await response!.text()).toBe("cached /insights");
  });

  it("offline: a non-shell page falls back to offline.html", async () => {
    const sw = await installed(async () => {
      throw new TypeError("offline");
    });
    const { response } = await sw.fetchEvent("/login", { mode: "navigate" });
    expect(await response!.text()).toBe("cached /offline.html");
  });

  it("offline with nothing cached: a shell route falls back to offline.html", async () => {
    const sw = await installed(async () => {
      throw new TypeError("offline");
    });
    (await sw.caches.open("shifty-shell-v2")).delete("/companion");
    const { response } = await sw.fetchEvent("/companion", { mode: "navigate" });
    expect(await response!.text()).toBe("cached /offline.html");
  });

  it("slow network: the cached shell answers after the timeout", async () => {
    const sw = await installed(() => new Promise<Response>(() => undefined), { instantTimers: true });
    const { response } = await sw.fetchEvent("/sessions", { mode: "navigate" });
    expect(await response!.text()).toBe("cached /sessions");
  });

  it("online: the network answer wins and the cookie-free copy is refreshed under the bare path", async () => {
    let version = 1;
    let impl: FetchImpl = async (input) => basic(`v${version} ${requestUrl(input).pathname}`);
    const sw = loadWorker({ fetch: (input, init) => impl(input, init) });
    await sw.dispatch("install");
    const shell = await sw.caches.open("shifty-shell-v2");
    // Pretend the stored copy is older than the refresh throttle by reloading the worker state.
    const fresh = loadWorker({ fetch: (input, init) => impl(input, init) });
    fresh.caches.stores.set("shifty-shell-v2", shell);
    version = 2;
    impl = async (input) => basic(`v${version} ${requestUrl(input).pathname}${requestUrl(input).search}`);

    const { response } = await fresh.fetchEvent("/sessions/view?id=abc", { mode: "navigate" });
    expect(await response!.text()).toBe("v2 /sessions/view?id=abc");
    expect(await (await shell.match("/sessions/view"))!.text()).toBe("v2 /sessions/view");
    expect(shell.has("/sessions/view?id=abc")).toBe(false);
    const refresh = fresh.fetch.mock.calls.map(([input]) => input).find((input): input is Request => input instanceof Request);
    expect(refresh?.credentials).toBe("omit");
  });
});

describe("service worker: static assets", () => {
  it("serves /_next/static cache-first, filling the cache at runtime", async () => {
    const sw = loadWorker({ fetch: async () => basic("chunk", { headers: { "Content-Type": "text/javascript" } }) });
    const first = await sw.fetchEvent("/_next/static/chunks/main-abc.js");
    expect(first.intercepted).toBe(true);
    expect(await first.response!.text()).toBe("chunk");
    expect(sw.fetch).toHaveBeenCalledTimes(1);

    const second = await sw.fetchEvent("/_next/static/chunks/main-abc.js");
    expect(await second.response!.text()).toBe("chunk");
    expect(sw.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not store failed static responses", async () => {
    const sw = loadWorker({ fetch: async () => basic("missing", { status: 404 }) });
    const { response } = await sw.fetchEvent("/_next/static/chunks/gone.js");
    expect(response!.status).toBe(404);
    expect((await sw.caches.open("shifty-static-v2")).has("/_next/static/chunks/gone.js")).toBe(false);
  });

  it("serves icons from the shell cache when offline", async () => {
    let online = true;
    const sw = loadWorker({
      fetch: async (input) => {
        if (!online) throw new TypeError("offline");
        return basic(`icon ${requestUrl(input).pathname}`);
      },
    });
    await sw.dispatch("install");
    online = false;
    const { response } = await sw.fetchEvent("/icons/icon-192.png");
    expect(await response!.text()).toBe("icon /icons/icon-192.png");
  });
});
