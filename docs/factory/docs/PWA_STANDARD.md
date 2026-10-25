# PWA standard

Detail behind [THE_WAY_BILL_MAKES_APPS.md](../THE_WAY_BILL_MAKES_APPS.md) §14. Kit: [templates/pwa](../templates/pwa/README.md) (identical to the template's copies).
Tags: **[U]** universal · **[P]** preferred default · **[S]** product-specific.

## 1. Decide per product [U]
| Product | PWA | Why |
| --- | --- | --- |
| Daily-use internal tool, field app, staff on phones | **On** | Home-screen launch, full screen, push |
| B2B SaaS used mostly at a desk | On (cheap) but push optional | Install is a bonus |
| Marketing / content site | Off | No app behaviour to install |
| Needs real offline data entry | On **plus** an explicit offline design (queue, conflict rules) | Never implied by the SW alone |
Record the decision in `factory/DECISIONS.md`.

## 2. Manifest [U]
- Served by `src/app/manifest.ts` → `buildManifest()` (`src/lib/pwa/manifest.ts`) at `/manifest.webmanifest`.
- **Every URL relative** (`id`, `start_url`, `scope`, icons): the same build works on previews and the final domain. Never hardcode a hostname (`tests/pwa.test.ts` enforces it).
- `display: "standalone"`, `name`, `short_name` (≤12 chars), `description`, `lang`, `background_color` = `theme_color` = app background.
- [P] `shortcuts` for the two most-used pages (e.g. My Work and the main table). [P] Theme-aware colors via `?theme=dark`.

## 3. Icons [U]
| File | Size | Purpose |
| --- | --- | --- |
| `public/icons/icon-192.png`, `icon-512.png` | 192, 512 | `any` |
| `public/icons/icon-maskable-192.png`, `-512.png` | 192, 512 | `maskable` (art inside the 80% safe zone, full-bleed background) |
| `public/icons/apple-touch-icon.png`, `src/app/apple-icon.png` | 180 | iOS home screen (no transparency) |
| `src/app/icon.png`, `src/app/favicon.ico` | 64, 32 | Browser tab |
- **All PNGs RGBA.** Turbopack rejects an `.ico` whose embedded PNG lacks alpha.
- `npm run pwa:icons '#hex'` (`scripts/generate-icons.mjs`) makes a correct set from the brand color with no image library; replace with real artwork later, same names and sizes.
- Bust cached favicons with `?v=` when they change (Safari keeps them per URL).

## 4. iOS and viewport [U]
- Root layout `viewport`: `viewportFit: "cover"`, `interactiveWidget: "resizes-content"`, `themeColor` for light and dark, `colorScheme: "light dark"`.
- `metadata.appleWebApp`: `capable: true`, `title`, `statusBarStyle: "default"` (keeps the status bar out of the page in both themes).
- [P] Launch screens for current iPhones/iPads (about 40 images from a splash script); without them iOS shows a blank screen briefly.
- Safe areas: `pt-safe`/`pb-safe`/`px-safe` utilities on top bar, bottom bar, sheets, dialogs, toasts; `env(safe-area-inset-*)` in `globals.css`.
- `overscroll-behavior: none` on `html, body` (no bounce/pull-to-refresh of the shell); scroll areas `contain`.
- [P] Links to other sites open in the browser, not inside the standalone app.

## 5. Service worker caching policy [U]
`public/sw.js` is hand-written and small.

| Request | Policy |
| --- | --- |
| Same-origin page navigation | Network first; on failure serve cached `/offline.html` |
| `/offline.html`, one icon | Precached at install |
| `/_next/static/*` | Browser HTTP cache (immutable hashed files); SW does not touch |
| `/api/*` responses | **Never cached** |
| Authenticated pages (HTML) | **Never cached** |
| Other origins (Supabase, CDNs, providers) | **Never intercepted** |
| Non-GET requests / mutations | **Never intercepted or queued** |
| Push events | Show notification; click focuses an open window and navigates, or opens one; only same-origin relative URLs |

`tests/pwa.test.ts` asserts: only navigations are handled, same-origin only, no `cache.put`, no `/api/`, precache list unchanged.

## 6. Offline claims [U]
- Default promise: "This app needs a connection. Nothing you saved was lost." (`public/offline.html`).
- Claim offline capability only for flows built and tested offline (airplane mode on device). Offline data entry needs: local queue (IndexedDB), idempotency keys per submission, conflict rule, visible sync status, and tests — design it as a feature, not a SW tweak.

## 7. Updates [U]
- `/sw.js` served with `Cache-Control: no-cache, no-store, must-revalidate` (`next.config.ts` headers) and registered with `updateViaCache: "none"`.
- New worker: `skipWaiting()` + `clients.claim()` — safe because it caches nothing pages depend on.
- Bump `CACHE` when `offline.html` or the icon changes; `activate` deletes old caches.
- Register in production only (`service-worker-registrar.tsx`), so dev never serves stale files.
- The proxy matcher excludes `sw.js`, `manifest.webmanifest`, `offline.html` and icons so they load signed out.

## 8. Push [P]
- Web Push with VAPID (`web-push`), one key pair per environment; rotating it invalidates every subscription.
- Subscriptions per device, stored own-rows-only; delete on 404/410; `pushsubscriptionchange` re-registers.
- **iOS: push only works for the app installed to the home screen (iOS 16.4+).** Safari users see "Install <App> to get alerts" with Share → Add to Home Screen, not a dead toggle.
- Ask permission from a user gesture on a one-time, dismissible card — never on page load. Preferences per notification type × channel.
- Push copies an in-app notification; it's best-effort and never fails the action.

## 9. Install experience [P]
- No custom install nag. A quiet "Install app" entry in settings/help, platform-specific instructions for iOS.
- First launch from the home screen lands on the role's home page (`start_url: "/"` → role redirect).

## 10. Test matrix [U]
| Device | Checks |
| --- | --- |
| iPhone (Safari, installed) | Install, splash, status bar both themes, safe areas (notch + home indicator), keyboard over sheets, push (if on), offline page |
| Android (Chrome, installed) | Install prompt, maskable icon shape, back button in sheets, keyboard resize, push |
| Tablet (iPad / Android) | Sidebar layout at 768/1024, landscape safe areas |
| Desktop (Chrome/Edge) | Install from address bar, window title, shortcuts |
Automated: `e2e/smoke.spec.ts` (manifest, SW headers, phone widths), `scripts/verify-production` (manifest + SW over HTTPS). Manual: [../checklists/pwa.md](../checklists/pwa.md).

## 11. Kit files
| Kit file | App location |
| --- | --- |
| `sw.js` | `public/sw.js` |
| `offline.html` | `public/offline.html` |
| `manifest.ts` | `src/lib/pwa/manifest.ts` (+ `src/app/manifest.ts`) |
| `service-worker-registrar.tsx` | `src/components/pwa/` (mount in root layout) |
| `generate-icons.mjs` | `scripts/` |
| `pwa.test.ts` | `tests/` |

## 11b. Offline-queue exception [U when `pwa.offline` is `offline-queue`] (simulation 3)
The default service worker caches nothing a page depends on. Products that must **work** offline (field apps) use
`templates/pwa/sw-offline.js` and `src/lib/offline/outbox.ts` under these rules:
| Rule | How |
| --- | --- |
| Shell, not data, in the SW cache | Cache-first only for hashed `/_next/static/**` and icons; a session-free `/offline-shell` route precached; still never `/api/`, authenticated HTML or other origins |
| Data lives in IndexedDB, per user | `IndexedDbOutboxStore(userId)`; drafts and reference data the person needs offline, nothing more |
| Every queued write is replayable | `client_id` on each write; server returns the original on replay (architecture standard §11b) |
| Order, retry, conflicts | Oldest first; retry network/408/429/5xx with backoff (≤ 5 min); 409 shown as a conflict; other 4xx dropped with the message |
| Sign-out clears everything | `store.clear()` + post `CLEAR_RUNTIME_CACHES` to the SW before redirecting to `/login` |
| The contract is written down | Blueprint `pwa.sync`: scope, triggers, conflict policy, max offline hours, storage budget, `clearOnSignOut: true` |
| Tested offline | An airplane-mode script in the release plan (create → photo → sign → reconnect → synced once, no duplicates) on a low-end Android and an installed iPhone |

## 12. Checklist
- [ ] PWA decision recorded
- [ ] Manifest relative URLs, any + maskable 192/512, apple-touch 180, RGBA everywhere
- [ ] `viewport-fit=cover`, safe areas on every fixed bar and sheet
- [ ] SW caches only offline page + icon; never API/auth pages/other origins/mutations
- [ ] `/sw.js` no-cache; versioned cache; old caches deleted
- [ ] Offline claims match what was tested
- [ ] Push: iOS installed-only messaging, permission from a gesture, per-type preferences
- [ ] Tested on iPhone installed, Android, tablet, desktop

Related: [UI_UX_STANDARD.md](UI_UX_STANDARD.md) · [../checklists/pwa.md](../checklists/pwa.md)
