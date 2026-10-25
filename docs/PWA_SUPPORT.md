# SHIFTY PWA support matrix

What the installed web app can and can't do on each platform. All of this is phase 1 (decisions D05, D07).
"Shell" means the app pages and build files. Your shifts are not part of it: they live in this device's IndexedDB.

**A PWA can't create iOS Live Activities or Dynamic Island timers.** No web API offers them. SHIFTY doesn't fake one.
See [LIVE_ACTIVITIES.md](LIVE_ACTIVITIES.md) for the native companion spec.

## Matrix
| Capability | iOS Safari tab | iOS home-screen app | Android Chrome (installed) | Desktop Chrome / Edge | Desktop Safari (macOS 14+) | Desktop Firefox |
| --- | --- | --- | --- | --- | --- | --- |
| Install | Share → Add to Home Screen (manual, no prompt) | Installed | "Install SHIFTY" button (`beforeinstallprompt`) or menu → Install app | Install button or address-bar icon | File → Add to Dock | No standard install. Works in a tab |
| Offline launch | Yes, after one online visit (service worker) | Yes, after one online launch | Yes, after one online visit | Yes | Yes | Yes |
| Live timer after suspension | Correct on return (from timestamps). Frozen while hidden | Same | Same | Same. Background tabs throttle redraws only | Same | Same |
| Notifications | **No.** The Notification API isn't there in a tab | iOS 16.4+, after a tap on "Allow". Only fire while the app is open or just backgrounded | Yes, through the service worker, while open or recent | Yes | Yes (tab or Dock app) | Yes |
| App badge | No | iOS 16.4+, needs notification permission | No (Android shows notification dots instead) | Yes, installed app | Dock app (Safari 17+) | No |
| Background Sync | No | No | Yes (API) | Yes (API) | No | No |
| Geolocation prompt | Asked per site. Safari may ask again later | Asked inside the app. Can ask again after updates | Asked once per site | Asked once per site | Asked per site | Asked per site |
| Storage persistence | **Best effort. Safari can delete site data after 7 days without a visit** | Own storage, not under the 7-day rule. Deleted if the icon is removed | Best effort. Chrome usually grants `persist()` to installed apps | Same as Android | 7-day rule in a tab. Dock app is like iOS installed | `persist()` shows a permission prompt |

SHIFTY's sync (`src/lib/store/**`) retries when the app opens or goes back online. Background Sync isn't available everywhere,
so SHIFTY doesn't depend on it. Reminders in phase 1 are local only (D07). They can't wake a closed app on any platform.
Web Push comes in phase 4 and needs VAPID keys and a server job.

## What the service worker does
| Request | Handling |
| --- | --- |
| Shell routes (`/`, `/sessions`, `/sessions/view`, `/sessions/new`, `/sessions/trash`, `/insights`, `/companion`, `/settings`, `/settings/data`, `/settings/privacy`, `/settings/account`) | Network first with a 3.5 s timeout. Falls back to the cached copy, then `/offline.html`. Cached **without the query**: `/sessions/view?id=…` opens offline. Stored copies are fetched **without cookies**, so a signed-in render is never cached |
| `/_next/static/**` | Cache first (hashed, immutable files). Filled at runtime and from the chunks the precached pages reference |
| Icons, manifest, `/offline.html` | Precached. Network first, cache when offline |
| `/api/*`, `/auth/*`, other origins, non-GET, RSC/prefetch fetches | Never intercepted |
| Updates | Versioned caches (`shifty-shell-vN`, `shifty-static-vN`), old ones deleted on activate. A new worker waits; the app shows "Update ready — Reload". `/sw.js` is served `no-cache` |

## Storage notes
- On first use, `requestPersistentStorage()` (`src/lib/store/persistence.ts`) calls `navigator.storage.persist()`. Each browser decides whether to grant it.
- On iPhone, the home-screen app and Safari have **separate storage**. Shifts logged in a Safari tab don't appear in the installed app. Install first, or move them with Export and Import.
- Removing the home-screen icon on iOS deletes that app's data. Export first.

## Test on a real iPhone
- [ ] Open the preview URL in Safari while online. Share → Add to Home Screen → open SHIFTY from the icon
- [ ] Settings: the capabilities table shows Reminders as "Not asked yet". Tap Allow notifications → iOS asks → "On"
- [ ] Turn on Airplane mode. Kill the app (swipe up). Open it from the icon. The home screen loads and nothing shows `offline.html`
- [ ] Still offline: tap CLOCK IN. The start time appears right away. Location shows "Location not captured" with a reason
- [ ] Lock the phone for 10+ minutes. Unlock and reopen: elapsed time matches a clock (from timestamps, no drift)
- [ ] Kill the app again and reopen offline: the session is still running with the correct elapsed time
- [ ] Open a session from Sessions, kill the app, reopen offline, open the same session: the detail page loads
- [ ] Turn Airplane mode off. Status changes Local → Syncing → Synced (only when sync is configured; device mode stays "On this device")
- [ ] Clock out. The recap shows. If notifications were allowed, the badge clears
- [ ] Deploy a new build and reopen the app: "Update ready — Reload" appears. Tap Reload: the app restarts on the new version and the session is still there
- [ ] Repeat the airplane-mode launch on Android Chrome (installed) and desktop Chrome. Record the results in `factory/MANUAL_CHECKS.md`
