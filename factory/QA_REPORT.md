# QA report — SHIFTY (lane/qa, 2026-10-25)

Independent QA by qa-engineer. Base commit `8d846ee` (merge: lane/insights). The tests were run against a production
build served with **no Supabase env** (device mode): `env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY
-u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_DB_URL -u SUPABASE_ACCESS_TOKEN npx next build && npx next start -p 3200`.
No command touched the Supabase project in this environment.
Builders' handoffs were used only to find things; every result below comes from a command run here.

**Verdict:** no blockers and no high-severity findings. 3 medium and 6 low findings (below). The core loop, the
acceptance anchors A/B, offline, corrections, exports, privacy and demo all PASS at desktop, 375 and 430.
Each bug is tracked by a test in `e2e/qa-findings.spec.ts`. These tests state the correct behaviour and carry
`test.fail()`, so the suite stays green while the bug is open. When a fix lands, Playwright reports "expected to fail
but passed": delete the `test.fail` line and the test becomes a regression guard. Run them with `QA_SHOW_BUGS=1` to
see each failure message.

## Results

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `npm run lint` | PASS (0 errors, 1 warning) | `src/lib/utils.ts:15 Unused eslint-disable directive (no-control-regex)` → L6 |
| 2 | `npm run typecheck` | PASS | `next typegen && tsc --noEmit` → "Types generated successfully", exit 0 |
| 3 | `npx vitest run` | PASS | `Test Files 39 passed (39) · Tests 379 passed (379)` |
| 4 | `npm run db:local-check` | PASS | `Organization isolation and role rules hold (91 checks, incl. SHIFTY)` · `Local migration + RLS check passed` |
| 5 | Factory gate `scripts/check --dir /home/user/lanes/qa --build --db` | PASS | `PASS lint (16s) · PASS typecheck (3s) · PASS unit tests (4s) · PASS build (26s) · PASS migrations + RLS (local Postgres) (3s) · check: all steps passed.` |
| 6 | Device-mode production build | PASS | `next build` exit 0; 47 routes, every app page `○ (Static)`; `/api/health` → `{"status":"ok"}`; `/api/sync/state` → 503 "Sync isn't set up yet…"; `/sw.js` `Cache-Control: no-cache, no-store, must-revalidate` |
| 7 | Full Playwright suite, 3 projects | PASS | `E2E_BASE_URL=http://localhost:3200 E2E_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test` → `134 passed, 4 skipped (7.1m)`, exit 0. Of the 134, 17 are expected failures (tracked bugs) and 117 are real passes |
| 8 | Core loop (fresh context): Home → Clock in (one tap) → timer ticks → Start/End break → Clock out → recap (net, breaks, elapsed) → Undo within 8 s → Clock out → one row in /sessions → detail day contributions sum to the total | PASS ×3 widths | `e2e/core-loop.spec.ts` "core loop…", no console errors |
| 9 | Acceptance A: Mon 18:00 → Tue 10:00 = 1 session, 16h, Mon 6h + Tue 10h (fake clock, Africa/Dar_es_Salaam) | PASS ×3 | `e2e/cross-midnight.spec.ts` A: recap `Mon 6h · Tue 10h`; detail rows "Monday 19 October: 6 hours net", "Tuesday 20 October: 10 hours net", `= 16h` |
| 10 | Acceptance B: + Tue 02:00–02:30 break = 15h 30m; detail Mon 6h / Tue 9h 30m; Insights week calendar mode Mon 6h, Tue 9h 30m; start mode Mon 15h 30m, Tue 0m; `/sessions?date=2026-10-20` shows the session with "9h 30m of 15h 30m" | PASS ×3 | `e2e/cross-midnight.spec.ts` B |
| 11 | F (DST) through the UI: Europe/London Sat 20:00 BST → Sun 10:00 GMT (clocks back 25 Oct 2026) = 15h, Sat 4h + Sun 11h | PASS ×3 | `e2e/probes.spec.ts` |
| 12 | H: clock in, `clock.fastForward("05:00:00")`, reload → Total elapsed `05:0x:xx` | PASS ×3 | `e2e/core-loop.spec.ts` H |
| 13 | I denied (`permissions: []`): clock-in at once (<5 s), "Location not captured — permission was denied…" + Try again | PASS ×3 | `e2e/core-loop.spec.ts` |
| 14 | I granted (geolocation −6.7924, 39.2083, ±12): "Location captured · ±12 m · hh:mm:ss" | PASS ×3 | `e2e/core-loop.spec.ts` |
| 15 | J: `dblclick` on Clock in, and two `click()`s in one task → exactly one session | PASS ×3 | `e2e/core-loop.spec.ts` (2 tests) |
| 16 | G offline: SW precaches the shell → offline reload loads Home → clock in offline → in-app nav to /sessions, full loads of /insights, /sessions, detail → online → still 1 session, pill "Sync: On this device" | PASS ×3 | `e2e/offline.spec.ts`; an uncached page (/terms) offline shows the offline page |
| 17 | K/M: edit start 09:00 → 08:30. No reason, and a 2-character reason, are both refused ("Say briefly why you're correcting the times."), nothing saved. With a reason: history shows the reason, `Start … 09:00 → … 08:30`, `Net 8h → 8h 30m` and the original start; totals recompute; survives reload | PASS ×3 | `e2e/corrections.spec.ts` |
| 18 | Manual entry overlapping another session is blocked; the alert names it ("It overlaps Morning cover, Thu 22 Oct (09:00–17:00)"); "Add session" is removed and Enter doesn't save | PASS ×3 | `e2e/corrections.spec.ts`. A confirmed "Save anyway (overlap)" does save → M1 |
| 19 | Export JSON + Sessions CSV + Day allocations CSV: UTC ISO instants (`2026-10-22T06:00:00.000Z`), `Africa/Dar_es_Salaam`, allocations `…,28800000,0,28800000,480`; formula title exported as `"'=HYPERLINK(` | PASS ×3 | `e2e/data-privacy.spec.ts` |
| 20 | Privacy: "Leave out precise location" redacts coordinates from the backup. "Delete all" location points → detail shows no coordinates or accuracy, and the backup has no coordinates (R10) | PASS ×3 | `e2e/data-privacy.spec.ts` |
| 21 | Import (F07): backup → fresh device → dry-run preview ("1 session"), nothing added before confirming → confirm → added. Re-importing the same file is skipped | PASS ×3 | `e2e/probes.spec.ts` |
| 22 | Demo: `/?demo=1` banner "Demo data — nothing is saved", >5 sessions. A clock action in demo writes 0 events to IndexedDB `shifty`. Exit demo → empty first-run Home, 0 sessions | PASS ×3 | `e2e/demo-companion.spec.ts` |
| 23 | Companion: recap shows `+N XP` and "New: First Clock-In"; /companion shows level and XP total; equip the unlocked Party hat → `aria-pressed=true` after reload | PASS ×3 | `e2e/demo-companion.spec.ts` |
| 24 | Goal is not a limit: at 17h the hero shows "Goal 16h · +1h past it" and a rest prompt. Still running at 21h (safety limit off by default) | PASS ×3 | `e2e/extras.spec.ts` |
| 25 | Undo grace A08: Undo is gone after 8 s; the end stays the tap time (09:00 → 10:00, 1h) | PASS ×3 | `e2e/probes.spec.ts` |
| 26 | Keyboard: Enter on Clock in / Clock out, Esc closes the recap | PASS ×3 | `e2e/extras.spec.ts` |
| 27 | Active ribbon on other pages links Home; trash → restore (F08); reload during a break stays on break; manual end in the future refused | PASS ×3 | `e2e/extras.spec.ts`, `e2e/probes.spec.ts` |
| 28 | Sweep, 19 app routes + the demo session detail, empty and demo data, light and dark, at 1280/375/430: no page or `<main>` sideways scroll; no console errors or hydration warnings; exactly one h1; every button/link named; theme follows `prefers-color-scheme`; phone inputs ≥16px; primary controls (nav, Clock in/out, breaks, Save) ≥44px | PASS ×3 | `e2e/sweep.spec.ts` (5 tests per project). Smaller targets are listed in `test-results/sweep-*.json` → L2, L4. The missing-session detail page is excluded and tracked as L1 |
| 29 | Public pages (/login, /signup, /forgot-password, legal ×4), light and dark: no overflow, one h1, named controls, no console errors, inputs ≥16px on phones | PASS ×3 | `e2e/sweep.spec.ts` |
| 30 | Tablet 768 and 1024 (ad-hoc script, no Playwright project): 19 routes × 2 themes × empty/demo, no overflow, one h1, no console errors | PASS | Script output: "tablet sweep: 19 routes x 2 widths x 2 themes x 2 data states, no overflow, one h1, no console errors"; `screenshots/tablet-*.png` |
| 31 | Smoke (template, updated for D04): health, tracking pages public, `/dashboard` → `/`, sync APIs 503 in device mode, legal pages, manifest + SW headers, login fits without iOS zoom | PASS ×3 | `e2e/smoke.spec.ts`. "Redirect to sign in" runs only when sync is configured → skipped here |
| 32 | Two tabs, one device (R01): after a reload the device holds one running session | PASS ×3 | `e2e/probes.spec.ts`. While both tabs stay open, though, the stale tab accepts a parallel clock-in → M3 |
| 33 | E2E on a Vercel preview at desktop/375/430 | NOT RUN | No preview URL was given to this lane. Run `E2E_BASE_URL=<preview> npx playwright test` once one exists |
| 34 | Signed-in flows: sync, 409 / Needs attention from the server, F09 device → account, sign-out warning, live RLS (`npm run db:check-rls`) | NOT RUN | No SHIFTY Supabase project yet (A01/D09). Local Postgres RLS passed (row 4) |
| 35 | Real devices: installed iPhone PWA, Android, haptics, notifications/badge | NOT RUN | Needs hardware. Listed for `factory/MANUAL_CHECKS.md` |
| 36 | Fixtures A–O cross-check | PASS (unit) + e2e | Unit tests name A–F and H–O (`tests/time-engine.test.ts`, `tests/shift-reducer.test.ts`, `tests/reports.test.ts`). G is covered by e2e row 16. TRD §3.6 is not in the repo, so the letter mapping follows the builders' labels and was not checked against the TRD |

Screenshots: `screenshots/` (gitignored, 259 files). This includes `{desktop,phone-375,phone-430}-{light,dark}-{empty,demo}-<route>.png`,
`state-{375,1280}-{light,dark}-{home-first-run,active-7h,recap}.png`, `tablet-*.png` and `two-tabs-needs-attention.png`.

## Findings

### Blocker
None.

### High
None.

### Medium

**M1 — Overlapping sessions: the product spec and the build disagree.**
PRODUCT.md R09 says "One person's sessions never overlap — database (deferrable exclusion constraint), api 409". A10
says "overlapping entries/imports/corrections refused". The build blocks the plain save, but it offers
**"Save anyway (overlap)"** in manual entry and Edit times, and the confirmed save goes through. There is no DB
constraint: migration 0102 says "Sessions of one person MAY overlap… guarded in the domain layer only", and D10 records
that choice.
Repro: /sessions/new, add Thu 22 Oct 09:00–17:00. Add 16:00–20:00, click "Save anyway (overlap)", then "Add anyway".
/sessions now lists 2 overlapping sessions, and both count in Insights for 16:00–17:00.
Test: `e2e/corrections.spec.ts` "R09 override…" (documents the current behaviour).
Needs: an orchestrator or Bill decision. Either update PRODUCT.md R09/A10 to "refused unless explicitly confirmed",
or remove the override.

**M2 — Per-day splits don't add up to the total shown (display rounding).**
The engine is exact, and the session detail apportions minutes correctly. But the recap, the active hero and the
Insights day table floor each day on its own.
Repro (fake clock, Dar es Salaam): clock in Mon 18:00:30, clock out Tue 01:12:30. The recap shows
**"7h 12m"** net with **"Mon 5h 59m · Tue 1h 12m"** (sum 7h 11m). The hero shows "Crossed midnight · 5h 59m on Mon,
1h 12m today" under 07:12. Insights → Net per day → Table has rows 5h 59m + 1h 12m and a Total of 7h 12m.
Home's week card showed 7h 11m beside an 07:12:00 readout, because it also uses `now` floored to 30 s.
With real clock-in seconds this happens on about half of cross-midnight shifts. R02 ("Σ day allocations = net") is
what users check by eye.
Cause: `daySplitLine` and `crossedMidnightLine` in `src/lib/home/view-model.ts` and the Insights `DataTable` rows use
`formatDuration` per day. `apportionMinutes` (`src/lib/sessions/wording.ts`) already solves this for
`DayContributions`.
Tests: `e2e/qa-findings.spec.ts` QA-M2 ×2 (`test.fail`), failing with "Mon 5h 59m · Tue 1h 12m vs 7h 12m — Expected 432,
Received 431".

**M3 — A second open tab (or the PWA next to a browser tab) is stale and accepts a parallel clock-in.**
Each tab keeps its own in-memory event list. It never re-reads IndexedDB on focus or visibility, and there is no
BroadcastChannel.
Repro: open `/` in two tabs. Clock in on tab A. Tab B still shows "Clock in", even after it is focused. Tap it, and tab
B shows its own running session and can clock it out. Both tabs say "On this device". After a reload, tab B's work is
refused: the pill reads "Needs attention" ("Clock-in on Sun 21:28 wasn't accepted: A session is already running.").
Nothing is lost or overwritten, since the events stay in IndexedDB under Retry/Discard. But the person worked a shift
in a tab that then disowns it (`screenshots/two-tabs-needs-attention.png`).
Test: `e2e/qa-findings.spec.ts` QA-M3 (`test.fail`).
Suggested fix: re-load events from IndexedDB on `visibilitychange`/`focus`, or post a BroadcastChannel message after
each `putEvent`.

### Low

**L1 — The "This session isn't on this device." page has no h1.** Every other screen has exactly one.
Repro: `/sessions/view?id=00000000-0000-4000-8000-000000000000`. Test: QA-L1.

**L2 — Buttons used as Radix triggers lose the 44px touch hit area on phones.** `DropdownMenuTrigger` and
`DialogTrigger` set `data-slot="dropdown-menu-trigger"` / `"dialog-trigger"` over the Button's `data-slot="button"`,
and the `[data-slot="button"]::after` rule in `globals.css` then doesn't apply.
Measured at 375: "More actions" on session detail is 40×40 (a tap 1px above it hits the `DIV` behind); Insights
"Share week" / "Share recap" are 40px tall. Test: QA-L2 (phones only).

**L3 — Copy: the rhythm card shows "Best 1 days".** Source: `src/components/home/side-cards.tsx:111`. Test: QA-L3.

**L4 — Other touch targets under 44px on phones** (from `test-results/sweep-phone-*.json`, all secondary):

| Target | Size |
| --- | --- |
| Settings back link "Settings" (`src/components/settings/parts.tsx:17`, `h-10`) | 85×40 |
| Companion → Achievements "See the session" | 94×17 |
| Companion → XP log session links | ~253×21 |
| Legal pages: "Back to SHIFTY" | ~109×19 |
| Legal pages: footer links | 17–24px tall |

**L5 — PRODUCT.md screen table drift.** It lists `/sessions/[id]`, but the route is `/sessions/view?id=…`, a static
shell. It also lists `/settings/team` (admin, template), but there is no page; `/api/team/*` exists.
Update PRODUCT.md, or add the page before accounts go live.

**L6 — Lint warning.** `src/lib/utils.ts:15` has an unused `eslint-disable` (`no-control-regex`).

## What QA changed (lane/qa)

| File | What |
| --- | --- |
| `e2e/smoke.spec.ts` | Template expectations fixed for D04: tracking pages public, `/dashboard` → `/` (or `/login` when sync is configured), the "redirect to sign in" test only when sync is configured (`/onboarding`), sync APIs 503/401 |
| `e2e/helpers.ts` | Shared helpers; `serveStatusFromPageClock` answers `/api/sync/status` from the page's fake clock (the store corrects the device clock by `serverTime`, which would undo `page.clock`) |
| `e2e/core-loop.spec.ts` · `cross-midnight.spec.ts` · `corrections.spec.ts` · `data-privacy.spec.ts` · `demo-companion.spec.ts` · `offline.spec.ts` · `extras.spec.ts` · `probes.spec.ts` | The journeys in the table above |
| `e2e/sweep.spec.ts` | Route × theme × data sweep (overflow, console, h1, names, 16px inputs, 44px primary targets, screenshots) |
| `e2e/qa-findings.spec.ts` | Tracked bugs M2 ×2, M3, L1, L2, L3 (`test.fail`, `QA_SHOW_BUGS=1` to see them fail) |

No product code was changed. `factory/STATE.md` "Verified" was left to the orchestrator, to avoid lane conflicts. The
rows to add are 5, 7, 9–10 and 16.
