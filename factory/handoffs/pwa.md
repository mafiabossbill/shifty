### 2026-10-25 pwa-mobile-engineer — offline shell, update flow, notifications, install guide
AGENT: pwa-mobile-engineer (pwa lane)
TASK: T12 (PWA part) — service worker shell cache (D05), offline page, safe updates, local notifications/badge (D07), install guide, capabilities table, manifest additions, support matrix
FILES CHANGED: `public/sw.js`, `public/offline.html`, `src/components/pwa/{service-worker-registrar.tsx,install-guide.tsx,capabilities.tsx}`, `src/lib/notify.ts`, `src/lib/pwa/{manifest.ts,install-prompt.ts}`, `tests/{pwa.test.ts,pwa-sw.test.ts,pwa-notify.test.ts}`, `docs/PWA_SUPPORT.md`, this file
WHAT WAS IMPLEMENTED:
- `public/sw.js`: caches `shifty-shell-v1` and `shifty-static-v1`. On activate it deletes any other `shifty-*`/`app-offline-*` cache. Install precaches the 11 shell routes, `/offline.html`, the manifest and 5 icons. Each one is fetched on its own: a 404 or a failure is logged and skipped. Install also precaches the `/_next/static/**` chunks that the stored HTML references. Navigations: network first, 3.5 s timeout, then the cached shell (keyed without the query), then `/offline.html`. `/_next/static/**` is cache first, filled at runtime, capped at 400 entries. Icons and manifest are network first, cache when offline. Never intercepted: `/api/*`, `/auth/*`, other origins, non-GET, RSC/prefetch fetches. Push and notificationclick handlers are kept. There is a `message` handler for `{type:"SKIP_WAITING"}`. Install does not call skipWaiting.
- Registrar: registers in production only (`updateViaCache: "none"`). When a worker is waiting it shows a sonner toast "Update ready" with a Reload action. Reload posts SKIP_WAITING, then reloads once on `controllerchange`; the first-install claim does not reload. It calls `registration.update()` when the app comes back to the foreground and starts listening for `beforeinstallprompt` early.
- `public/offline.html`: self-contained, ink #0c0a18 / lilac #8b7bff in dark, cream #fbf8f1 in light. Plain steps (reconnect, open once, then it works offline). 48px button, safe-area padding.
- `src/lib/notify.ts`, `src/lib/pwa/install-prompt.ts`, `<InstallGuide />`, `<PlatformCapabilities />`: APIs listed below.
- Manifest: `display_override`, `launch_handler` (navigate-existing), categories productivity/utilities, 3 shortcuts. `id: "/"` was already there. Theme and background colours are untouched.
- `docs/PWA_SUPPORT.md`: platform × capability matrix, what the service worker does, storage notes, real-iPhone test checklist.
IMPORTANT DECISIONS:
- Shell HTML is always stored from a separate `credentials: "omit"` fetch: at install, and as a background refresh after a successful navigation (at most every 5 min per route). The person's credentialed response is never written to the cache, so a signed-in render (email in the top bar, for example) can't be stored. Cost: one extra small GET per shell route per 5 minutes.
- Responses we don't store have their bodies cancelled, and precache fetches abort after 15 s. Without this, install hung forever in real Chromium: 8 unread 404 bodies (routes not in this lane's build) held the connections and the PPR routes never finished. The unit tests passed; only the browser run caught it.
- Shell copies are read back from the cache to collect chunk URLs (no stream tee).
- Bump `VERSION` in `public/sw.js` when the caching logic or the route list changes; the browser only installs a new worker when `sw.js` bytes change. Ordinary deploys need no bump: shell HTML refreshes on online navigation, new chunks fill the static cache at runtime, and old cached HTML keeps working offline because its old chunks stay in the static cache.
DEPENDENCIES:
- Home screen lane: handle `/?action=clock-in` from the manifest shortcut. Suggest: focus or highlight the Clock in button, or clock in once, idempotently, after the screen loads. Don't loop on re-render.
- Settings lane: mount `<PlatformCapabilities />` (Settings → device/notifications) and `<InstallGuide />` (Settings, and maybe a dismissible card on the home screen). Store the reminder preference yourself. `requestNotifications()` must run from a tap.
- Reminder/active-session lane: call `showLocalNotification()` for 12/14/16h prompts (use a `tag` per milestone) and `setBadge()`/`clearBadge()` while a shift runs.
- Shell (ux lane): the sonner Toaster must be mounted on every shell route (today it is only in `(app)/layout.tsx`), or the update toast is invisible on pages without it.
- Persistent storage: `requestPersistentStorage()` already lives in `src/lib/store/persistence.ts` (store lane). The docs describe it; this lane doesn't call it.
KNOWN RISKS:
- Not tested on real devices: no iPhone (Safari tab or installed) and no Android install. Install, iOS notification permission and badge are unverified. Chromium emulation only.
- iOS keeps home-screen app storage separate from Safari: shifts logged in a tab don't appear after install. The install guide and docs say so. A migration path (export/import) depends on the data lane.
- RSC client navigations are not cached. Offline, a `<Link>` RSC fetch fails, Next falls back to a hard navigation, and the worker serves the cached shell. This was not exercised with the real screens: this lane's build only has `/`, `/settings`, `/settings/account`, so `/sessions/view` offline showed offline.html. Re-run the offline check on the merged build.
- Static cache cap (400) evicts oldest-inserted, not least-used. Fine for a single app; revisit if chunk counts grow a lot.
- In the browser test, `controllerchange` fired about 0.5 s before activate finished deleting old caches. The deletion completed (verified). The reload happens in that window and is served by the new worker.
TESTS RUN: `npm run lint`; `npm run typecheck`; `npx vitest run`. Mutation checks on sw.js: removing the /api guard, the origin guard, credentials-omit, slash normalisation and the cache fallback each fail tests. Browser: production `next build` + `next start` of a hard-linked copy in the scratchpad, Chromium 1243 via Playwright: install, offline navigations, update flow. `next dev` with a temporary scratch page for `<InstallGuide />`/`<PlatformCapabilities />` at 375 (iPhone UA, light+dark), 430 (Android UA + simulated `beforeinstallprompt`, dark) and 1280 (light).
TEST RESULTS:
- lint PASS; typecheck PASS; vitest 29 files / 264 tests PASS (51 PWA: `pwa.test.ts` 6, `pwa-sw.test.ts` 24, `pwa-notify.test.ts` 21).
- Production browser run:
  - SW activated and claimed. Shell cache holds `/`, `/settings`, `/settings/account`, offline page, manifest and icons; 19 static chunks were precached from the HTML.
  - Offline, every navigation was answered by the worker: `/`, `/settings?tab=x` (bare key) and `/settings/account/` (trailing slash) got the cached shell. `/login` and `/sessions/view?id=abc` (missing in this build) got offline.html. `/api/health` was not intercepted (`ERR_INTERNET_DISCONNECTED`).
  - `/sw.js` header: `Cache-Control: no-cache, no-store, must-revalidate`.
  - Update: v2 waited; SKIP_WAITING led to controllerchange; v1 caches deleted, v2 kept.
- offline.html at 375: no sideways scroll, 48px button, both themes on-brand.
- Components at 375/430/1280: scrollWidth equals the viewport, buttons 44px, no console errors. The first capabilities layout clipped the status column at 375; fixed with `table-fixed` and a fixed status column, then re-checked.
NEXT AGENT ACTION: orchestrator — merge lane/pwa, build in the main checkout and re-run the offline check with the real screens (`/sessions/view?id=…` offline must open the cached shell). Settings and home lanes mount the components and handle `?action=clock-in` (see DEPENDENCIES). QA: run the iPhone checklist in `docs/PWA_SUPPORT.md` on a real device and record it in `factory/MANUAL_CHECKS.md`.
COMMIT: see `git log -1` on lane/pwa (not pushed)
