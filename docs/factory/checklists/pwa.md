# PWA checklist

Only when the product's PWA decision is "on". Standard: [../docs/PWA_STANDARD.md](../docs/PWA_STANDARD.md). Kit: [../templates/pwa/README.md](../templates/pwa/README.md).

## Manifest
- [ ] `/manifest.webmanifest` answers 200 signed out (proxy matcher excludes it)
- [ ] `name`, `short_name`, `description`, `display: "standalone"`, `start_url: "/"`, `scope: "/"`, `id: "/"`
- [ ] No absolute URLs anywhere in the manifest (`tests/pwa.test.ts`)
- [ ] Icons: any 192 + 512, maskable 192 + 512 (art inside the safe zone), all RGBA PNG of the declared size
- [ ] `theme_color` / `background_color` match the app background

## iOS and installed polish
- [ ] `apple-touch-icon` (180px), `appleWebApp.capable`, status bar style chosen deliberately
- [ ] `viewport-fit=cover`; safe-area padding on bars, sheets, toasts
- [ ] Favicon `.ico` embeds an RGBA PNG (Turbopack rejects non-alpha ICOs) — `scripts/generate-icons.mjs`
- [ ] Launch screens generated if the brand needs them
- [ ] External links open in the browser, app links stay in the app

## Service worker
- [ ] `/sw.js` served with `Cache-Control: no-cache` (`next.config.ts` headers); registered with `updateViaCache: "none"`
- [ ] Caches only the offline page and its icon; never API responses, authenticated pages, other origins or mutations (`tests/pwa.test.ts`)
- [ ] Navigations network-first; offline page shown only when the network fails
- [ ] New version activates safely: versioned cache name, old caches deleted on `activate`
- [ ] Registered in production only

## Offline claims
- [ ] The UI says "needs a connection" for anything not built for offline
- [ ] Any real offline feature (e.g. queued field inspections) has its own design, conflict rules and tests — never implied by the SW

## Push (if used)
- [ ] VAPID keys per environment; push off cleanly when missing
- [ ] iOS: prompt only in the installed app (16.4+); Safari users see install instructions
- [ ] Notification click opens a same-origin deep link

## Test on devices
- [ ] iPhone: Add to Home Screen, open, sign in, rotate, background/foreground
- [ ] Android Chrome: install prompt/menu install, open standalone
- [ ] Tablet and desktop Chrome install
- [ ] `scripts/verify-production <url>` PASS (manifest, icon, sw headers)
