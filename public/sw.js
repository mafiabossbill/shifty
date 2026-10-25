/*
 * SHIFTY service worker (decision D05). Personal data lives in IndexedDB, never in
 * pages, so the static app SHELL can be cached for offline launch.
 *
 * What it caches
 * - shell cache: the shell routes below (HTML fetched WITHOUT cookies, so a
 *   signed-in render is never stored), offline.html, icons, manifest.
 * - static cache: /_next/static/** (content-hashed, immutable), filled at runtime
 *   and from the chunks the precached shell HTML references.
 *
 * What it never touches: /api/*, /auth/*, other origins, non-GET requests,
 * RSC/data fetches. Those go straight to the network.
 *
 * Updates: bump VERSION when this file's caching changes. A new worker waits;
 * the page shows "Update ready" and posts {type:"SKIP_WAITING"}. Activate deletes
 * every shifty-* cache that is not the current version. /sw.js is served no-cache
 * (next.config.ts) so the browser always checks for a new worker.
 */
const VERSION = "v2";
const SHELL_CACHE = `shifty-shell-${VERSION}`;
const STATIC_CACHE = `shifty-static-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE];
const OWN_CACHE_PREFIXES = ["shifty-", "app-offline-"];
const OFFLINE_URL = "/offline.html";
const NAVIGATION_TIMEOUT_MS = 3500;
const SHELL_REFRESH_MS = 5 * 60 * 1000;
const STATIC_MAX_ENTRIES = 400;
const PRECACHE_TIMEOUT_MS = 15000;

/** Static routes whose HTML is a shell with no personal data (D04). Keyed without the query string. */
const SHELL_ROUTES = [
  "/",
  "/sessions",
  "/sessions/view",
  "/sessions/new",
  "/sessions/trash",
  "/insights",
  "/companion",
  "/settings",
  "/settings/sessions",
  "/settings/appearance",
  "/settings/pay",
  "/settings/places",
  "/settings/data",
  "/settings/privacy",
  "/settings/account",
  "/settings/device",
];

const SHELL_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

const NEVER_INTERCEPT = [/^\/api(\/|$)/, /^\/auth(\/|$)/];
const STATIC_PREFIX = "/_next/static/";

/** When each shell route was last stored (per worker lifetime; throttles background refreshes). */
const lastShellRefresh = new Map();

/** "/sessions/" → "/sessions"; root stays "/". */
function normalizePath(pathname) {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function isShellRoute(pathname) {
  return SHELL_ROUTES.includes(normalizePath(pathname));
}

/** Only a plain, same-origin, final 200 is worth keeping. A redirected response can't answer a navigation. */
function cacheable(response) {
  return Boolean(response) && response.status === 200 && !response.redirected && response.type === "basic";
}

/** Release a response we won't use, so its connection is freed instead of waiting for GC. */
function discard(response) {
  try {
    if (response && response.body && !response.bodyUsed) response.body.cancel().catch(() => undefined);
  } catch {
    /* nothing to release */
  }
}

/** Precache fetches give up after a while, so a hung request can never block install forever. */
async function fetchWithTimeout(input, init = {}, ms = PRECACHE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(new Request(input, { ...init, signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}

function log(message, detail) {
  try {
    console.info(JSON.stringify({ sw: VERSION, message, ...detail }));
  } catch {
    /* logging must never break the worker */
  }
}

function staticUrlsIn(html) {
  const found = new Set();
  const pattern = /\/_next\/static\/[^"'\s)\\<>]+/g;
  let match;
  while ((match = pattern.exec(html)) !== null) found.add(match[0]);
  return [...found];
}

async function precacheStatic(urls) {
  if (urls.length === 0) return;
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(
    urls.map(async (url) => {
      try {
        if (await cache.match(url)) return;
        const response = await fetchWithTimeout(url);
        if (cacheable(response)) await cache.put(url, response);
        else discard(response);
      } catch (error) {
        log("static precache failed", { url, error: String(error) });
      }
    }),
  );
}

/**
 * Store one shell route, fetched without cookies so the stored HTML is the
 * signed-out shell. A route missing from this build is logged and skipped.
 * Returns the /_next/static URLs the HTML references.
 */
async function storeShell(path, cache) {
  try {
    const response = await fetchWithTimeout(path, { credentials: "omit", cache: "no-cache" });
    if (!cacheable(response)) {
      log("shell route not cached", { path, status: response ? response.status : 0 });
      discard(response);
      return [];
    }
    await cache.put(path, response);
    lastShellRefresh.set(path, Date.now());
    // Read the stored copy back instead of tee-ing the network stream.
    const stored = await cache.match(path);
    return stored ? staticUrlsIn(await stored.text()) : [];
  } catch (error) {
    log("shell route fetch failed", { path, error: String(error) });
    return [];
  }
}

async function precache() {
  const cache = await caches.open(SHELL_CACHE);
  await Promise.all(
    SHELL_ASSETS.map(async (asset) => {
      try {
        const response = await fetchWithTimeout(asset, { cache: "no-cache" });
        if (cacheable(response)) await cache.put(asset, response);
        else {
          log("asset not cached", { asset, status: response.status });
          discard(response);
        }
      } catch (error) {
        log("asset fetch failed", { asset, error: String(error) });
      }
    }),
  );
  const lists = await Promise.all(SHELL_ROUTES.map((path) => storeShell(path, cache)));
  await precacheStatic([...new Set(lists.flat())]);
}

self.addEventListener("install", (event) => {
  // No skipWaiting here: a new worker waits until the page asks (update toast).
  event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => OWN_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)) && !CURRENT_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

/** Refresh the cookie-free copy of a shell route in the background, at most every few minutes. */
async function refreshShell(path) {
  const last = lastShellRefresh.get(path) || 0;
  if (Date.now() - last < SHELL_REFRESH_MS) return;
  lastShellRefresh.set(path, Date.now());
  const cache = await caches.open(SHELL_CACHE);
  await precacheStatic(await storeShell(path, cache));
}

async function cachedShell(path) {
  const cache = await caches.open(SHELL_CACHE);
  return (await cache.match(path)) || undefined;
}

async function offlinePage() {
  const cache = await caches.open(SHELL_CACHE);
  return (
    (await cache.match(OFFLINE_URL)) ||
    new Response("You're offline. Reconnect and try again.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  );
}

/**
 * Network first. Shell routes: if the network is slow (timeout) and a cached copy
 * exists, show it; if the network fails, cached copy, then offline.html. The
 * cached copy is keyed without the query (/sessions/view?id=… → /sessions/view).
 */
async function handleNavigation(event, url) {
  const path = normalizePath(url.pathname);
  const network = fetch(event.request);

  if (!isShellRoute(path)) {
    try {
      return await network;
    } catch {
      return offlinePage();
    }
  }

  const fromNetwork = network.then((response) => {
    if (response && response.ok) event.waitUntil(refreshShell(path).catch(() => undefined));
    return response;
  });
  // A late rejection after the cached copy already answered must not surface as unhandled.
  fromNetwork.catch(() => undefined);

  let timer;
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => resolve("timeout"), NAVIGATION_TIMEOUT_MS);
  });

  try {
    const first = await Promise.race([fromNetwork, timedOut]);
    if (first !== "timeout") return first;
    const cached = await cachedShell(path);
    if (cached) return cached;
    return await fromNetwork;
  } catch {
    return (await cachedShell(path)) || offlinePage();
  } finally {
    clearTimeout(timer);
  }
}

/** Hashed build files never change: cache first, filled at runtime. */
async function handleStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (cacheable(response)) {
    await cache.put(request, response.clone());
    trimStatic(cache).catch(() => undefined);
  }
  return response;
}

/** Old deploys' chunks pile up in the same versioned cache; drop the oldest past a cap. */
async function trimStatic(cache) {
  const keys = await cache.keys();
  const excess = keys.length - STATIC_MAX_ENTRIES;
  for (let i = 0; i < excess; i += 1) await cache.delete(keys[i]);
}

/** Icons, manifest, offline page: network first, cached copy when offline. */
async function handleShellAsset(request, path) {
  try {
    const response = await fetch(request);
    if (response.ok) return response;
    return (await (await caches.open(SHELL_CACHE)).match(path)) || response;
  } catch (error) {
    const cached = await (await caches.open(SHELL_CACHE)).match(path);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_INTERCEPT.some((pattern) => pattern.test(url.pathname))) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event, url));
    return;
  }
  if (url.pathname.startsWith(STATIC_PREFIX)) {
    event.respondWith(handleStatic(request));
    return;
  }
  if (SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(handleShellAsset(request, url.pathname));
  }
  // Everything else (RSC payloads, prefetches, other files) goes to the network untouched.
});

// Web Push: inert until the app subscribes a device (phase 4, D07).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/";
  event.waitUntil(
    self.registration.showNotification(data.title || "SHIFTY", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      tag: data.tag || undefined,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        return existing.navigate(target).catch(() => self.clients.openWindow(target));
      }
      return self.clients.openWindow(target);
    }),
  );
});
