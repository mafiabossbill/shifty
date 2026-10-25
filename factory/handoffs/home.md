# Handoff — frontend-engineer (lane/home)

| Field | Value |
| --- | --- |
| AGENT | frontend-engineer (home lane) |
| TASK | SHIFTY Home: clock-in hero, active session, recap, nudges, week/rhythm/last session; ActiveRibbon + DemoBanner; SyncStatus + sheet |
| COMMIT | see `git log -1` on lane/home (not pushed); PWA lane merged in before it (`claude/relaxed-davinci-y8k5u9`) |

## FILES CHANGED
| Area | Files |
| --- | --- |
| Route | `src/app/(app)/page.tsx` (static shell, `<Suspense>` around the client screen) |
| Home | `src/components/home/{home-screen,clock-in-hero,active-hero,recap-sheet,side-cards,shared,nudge-notifier}.tsx` |
| Ribbon | `src/components/session/active-ribbon.tsx` |
| Sync | `src/components/sync/{sync-status,sync-sheet,demo-banner}.tsx` |
| Shell | `src/components/shell/slots.tsx` (both slots filled) |
| View models | `src/lib/home/{view-model,sync-view}.ts` |
| Tests | `tests/home-view-model.test.ts`, `tests/home-sync-view.test.ts` |

## WHAT WAS IMPLEMENTED
- **Greeting row**: "Good evening, Bill" (hour in the reporting zone, no name means no comma) + 48px Mochi dressed from `profile.companion`. Mood comes from `moodFor` (idle / active / on_break / just_finished for 10 min after a clock-out) and shows its line.
- **Clock in**: a 176–192px round primary `Button size="xl"` inside a glowing ring on a hero card with a soft violet glow. Goal line "Goal 16h net · <zone>". "Add details" opens title (prefilled with `smartTitle`), project (live projects only), tags (comma list, deduped, ≤10) and note. The one-tap path never waits on it. Haptic `vibrate(15)` when `settings.haptics` is on. Mochi celebrates for 2.5 s.
- **`?action=clock-in`**: the heading becomes "Clock in now?", the button gets focus, and "Not now" clears the param. A page load never clocks in. The param is removed after clocking in, or when a session already runs.
- **Active hero**: `ProgressRing` (goal ratio capped, overage on its own arc, celebrate tone on break, halo). The NET WORKED readout is HH:MM in `type-hero tabular` with the seconds smaller. TOTAL ELAPSED ("Breaks included") and BREAKS ("n breaks · not in net") sit side by side as two labelled figures. Also shown:
  - a Working / On break pill
  - "Started Sun 25 Oct, 18:00 GMT+3", in the session zone
  - "Goal at 10:30 today" while working, or the running break time while on break
  - "+1h 20m past it" after the goal (neutral)
  - "Crossed midnight · 6h on Mon, 9h 30m today", from `allocateByDay`
  - the location line: captured "Office · ±12 m · 18:00:09", or `LOCATION_STATUS_COPY` + "Try again" (`retryLocation`); "No location recorded" after 90 s without any fix
  - controls: Start break / End break, and a calm danger-tinted Clock out

  The timer always comes from `sessionMetrics(session, useNow(1000))`.
- **Recap sheet**: opens the moment you clock out. It shows:
  - net worked, elapsed, breaks, days, and the per-day split "Sun 5h 59m · Mon 11h 20m"
  - neutral overage: "+1h 20m past your goal. Rest well."
  - XP total with lines and notes from `summaryForSession`, plus the session's new achievements
  - Mochi: resting after a long shift, celebrating or proud otherwise
  - optional 1–5 mood and energy scales and a note, saved with `annotate` on "Save and close"
  - "Undo clock-out (8)" with a countdown, calling `undoClockOut()`; if it's too late, a toast says so
- **Nudges**: `nudgesFor(...)` cards sit under the hero, so the timer stays first on phones; dismissing calls `dismissNudge`. Local notifications go through `showLocalNotification(title, {body, tag: nudge.id, url: "/"})`. They fire once per id (remembered in localStorage), only when `settings.notifications` is on and permission is granted. This runs inside the always-mounted ribbon, so it works on every page.
- **App badge**: `setBadge(1)` while a session runs, `clearBadge()` when none, from the ribbon.
- **Below the hero**:
  - Last session card (when idle), linking to `/sessions/view?id=…`; title falls back to `smartTitle(hour, place)`
  - This week: net in calendar mode, breaks, days worked, and 7 bars in week-start order with today highlighted; a screen-reader list gives the text alternative
  - Rhythm: streak, today's logged / pending / rest state in forgiving words, freezes, best run, level link
- **First run**: Mochi + "One tap starts your first shift" + one sentence + Clock in + a "Try the demo" link (a full load of `/?demo=1`).
- **Desktop ≥1024**: hero on the left (1.5fr), and on the right the last session, week and rhythm.
- **ActiveRibbon**: on every page except `/`, a slim bar: pulsing dot, "Working · 06:42:10 net" or "On break · 00:12:03", linking to `/`. It's a floating pill above the bottom bar on phones and a full-width bar under the top bar on desktop.
- **DemoBanner** (same slot): "Demo data — nothing is saved · Exit demo" (`exitDemo`).
- **SyncStatus**: the pill follows the brief's mapping: attention or foreign_data → Needs attention; device/unconfigured → On this device; signed_out → Sign in to sync; attach_pending → Ready to upload; account offline → Offline · saved here; syncing → Syncing; pending → Local · n; error → Sync paused; else → Synced.

  Tapping opens a sheet with:
  - a plain explanation and the last synced time
  - "Sync now" when it applies
  - the attach prompt: "Upload the n sessions saved on this device to your account?" → `attachToAccount`
  - foreign_data: an explanation and a link to `/settings/account`
  - sign-in / account links
  - the Needs attention list: each refused event as a sentence ("Clock-in on Mon 18:00 wasn't accepted: A session is already running."), with Details (event type, time + zone, recorded time, error code, attempts), Retry, and Discard. Discard goes through `useConfirm`, and the confirm text explains that discarding a clock-in drops that device-only session.

## IMPORTANT DECISIONS
| Decision | Why |
| --- | --- |
| Undo window tracked locally too (tap time + 8 s, A08); `undoClockOut()` stays the authority | `view.undo` doesn't appear after `clockOut()` (see store bug below), so Undo would never show |
| `useHydrated()` gate (`view.ready && hydrated`) in Home, SyncStatus, DemoBanner, ribbon | `useShift()` hands hydration the live client snapshot, which caused real hydration errors (see below) |
| Notifications and the badge live in the ribbon component, not on Home | It's mounted on every page; nudges still render as cards only on Home |
| Seconds smaller than HH:MM inside the ring | HH:MM:SS at hero size doesn't fit a 296px ring at 375px |
| Start-line zone abbreviation always shown on Home | The brief's example shows it ("18:00 EAT"); the lane rule says only when it differs from the device zone. Easy to change in `active-hero.tsx` |
| Title only sent at clock-in when "Add details" is open | Otherwise other screens can still derive `smartTitle` with the place matched later |
| Sync sheet times in the device zone | Sync is about this device, not a session |

## DEPENDENCIES / ISSUES FOR OTHER OWNERS
- **Store bug (`src/lib/store/store.ts`, `setUndo`)**: it sets `this.undo` and the timer but doesn't call `recompute()` or notify listeners. So `view.undo` stays null after `clockOut()` until some unrelated change. Fix: call `this.view = { ...this.view, undo: this.undo }; this.listeners.forEach(l => l())` in `setUndo`. Home works either way.
- **`src/lib/store/react.tsx` `useShift()`**: `getServerSnapshot` returns `store.getSnapshot()`. A Suspense boundary that hydrates after `init()` gets `ready: true` while the server HTML had `ready: false`, and React throws a hydration mismatch (reproduced on `/?action=clock-in`). Fix: return a constant not-ready view on the server and during hydration. Other lanes that read `view.ready` directly will hit this.
- **Dev server with `--webpack` serves no Tailwind** (no PostCSS config; Tailwind is wired only through the Turbopack loader), so screenshots are unstyled. I swapped `node_modules` for a hard-linked copy (`cp -al`) and ran Turbopack (`npx next dev -p 3111`), then restored the symlink. Other lanes (insights runs `--webpack`) should check their screenshots.
- Lanes share the scratchpad: another lane writes `dev.log` in the same scratchpad path.
- Uses `src/lib/notify.ts` (PWA lane) and every contract read-only. No primitives, store, domain or other routes were edited.

## KNOWN RISKS
- Notifications and the badge were checked with stubbed `Notification` / `setAppBadge` in headless Chromium, not on a real iPhone or Android.
- The fake-time journeys shifted `Date.now` and `/api/sync/status` `serverTime` together, because the store corrects the device clock to server time.
- Two nudges can show at once (milestone + break). That's the domain's choice; both are dismissible.

## TESTS RUN
| Command | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npx vitest run` | PASS: 33 files, 307 tests (37 new in `tests/home-*.test.ts`) |
| Playwright (Turbopack dev, port 3111), widths **390 and 1280, light and dark** | PASS. 0 console errors, no horizontal overflow on the page or in `main` |

Journeys covered in the Playwright run:
1. Fresh profile: empty state, details open, clock in (geolocation granted, "Office ±12 m"), start break, ribbon on `/sessions`, end break, clock out → recap, Undo (session restored), clock out again, mood 3, save, sync sheet.
2. `?demo=1` history: last session, week bars, 56-day rhythm, banner.
3. `?action=clock-in` prompt in Africa/Dar_es_Salaam with shifted time: 18:00 start, break, 12h20 net with two nudges, crossed midnight, 17h20 net with the overage arc, recap showing "+1h 20m past your goal. Rest well." and "Sun 5h 59m · Mon 11h 20m".
4. Reduced motion: 0 running animations.
5. Notifications: off by default, so nothing fired. On, with permission granted: "12 hours in" and "Time for a break?" fired once each, tagged with the nudge id. Badge [1] on clock-in, [0] on clock-out.

Screenshots: `screenshots/home-*` (gitignored).

## NEXT AGENT ACTION
- Store owner: fix `setUndo` notification and `useShift` `getServerSnapshot` (above); then the Home fallbacks can stay or go.
- Companion-settings lane: the notifications toggle must call `requestNotifications()` from the tap. Home already honours `settings.notifications`.
- QA: real-device pass (iPhone installed PWA for notifications and badge, Android), 430/768 widths.
