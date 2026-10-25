# Handoff — frontend-engineer (lane/companion: Companion + Settings)

| Field | Value |
| --- | --- |
| AGENT | frontend-engineer (companion-settings lane) |
| TASK | `/companion` (Mochi, level, rhythm, wardrobe, room, achievements, XP log) and `/settings/**` (sessions, appearance, pay, places, privacy, data, account, this device, demo) |
| COMMIT | see `git log lane/companion` (not pushed): feat(companion,settings) · feat(settings) PWA wiring · refactor + this handoff |

## FILES CHANGED
| Area | Files |
| --- | --- |
| Routes | `src/app/(app)/companion/page.tsx`; `src/app/(app)/settings/{layout,page}.tsx`, `settings/{sessions,appearance,pay,places,privacy,data,account,device}/page.tsx`; deleted `settings/team/page.tsx` |
| Companion UI | `src/components/companion/{companion-screen,companion-hero,level-card,rhythm-card,item-grid,item-preview,achievements-list,xp-log,celebration,how-xp,use-companion}.tsx/ts` |
| Settings UI | `src/components/settings/{settings-shell,settings-menu,nav,settings-icon,parts,demo-link,session-settings,timezone-picker,appearance-settings,pay-settings,places-settings,privacy-settings,data-settings,printable-report,account-settings,device-settings}.tsx/ts` |
| Pure helpers | `src/lib/settings/{timezones,goal,ledger,companion,locations,report,data}.ts` |
| Tests | `tests/settings-helpers.test.ts` (13), `tests/companion-helpers.test.ts` (11) |
| Removed | `src/components/team/team-settings.tsx` (only the deleted team page imported it) |

## WHAT WAS IMPLEMENTED
- **Companion**: a `Habitat` hero (resolved theme; day/evening/night from the local hour in the reporting zone) with a 170px `Mochi` wearing the equipped look. Mood comes from `moodFor` (active, on break, just finished within 30 min, idle; celebrating while a new achievement shows). Name is editable inline (`updateCompanion`). Level card shows the level (never below `highestLevel`), the XP bar from `progress`, total XP and `nextUnlocks(level, 3)` with previews. Rhythm card shows now, best, freezes and today's status with forgiving copy.
- **Companion tabs** (SegmentedControl, kept in `?tab=`):
  - Wardrobe: colours, hats and accessories, plus a "none" tile.
  - Room: places, and decor capped at 6 (a toast says when the room is full; wall decor is marked "not shown outdoors").
  - Achievements: all 10. Earned ones show the date, a "See the session" link (`/sessions/view?id=`) and the reward; unearned ones show the hint on a warm dashed card, never greyed out.
  - XP log: grouped by day with a daily total, newest first, in plain words. Reversals read "Adjusted after an edit" or "Adjusted after a change". Rows link to their session.
- **Companion extras**: locked items show "Level 7" or "Earn Night Owl". A celebration banner appears once per newly earned achievement (seen codes in localStorage; demo uses its own key). A "How XP works" disclosure.
- **Settings shell**: phones and tablets get a grouped menu with a live summary per row, then sub-pages with a back link. From 1024px a grouped side nav, and `/settings` shows Your sessions.
- **Your sessions**: goal in h + m (1 min–48 h, saved on blur or Enter, error sentence otherwise). Timezone picker in a sheet: search by city, region or "GMT+3"; device zone suggested; the agreed copy about existing sessions. Week start, 12/24h, planned workdays chips, reminder hours 12/14/16/18, break nudge, notifications switch, and an opt-in safety limit (default 20 h, copy says it clocks out at the limit).
- **Appearance**: `ThemeSetting` and `AccentSetting` with `onChange` → `updateSettings`; reduce motion (same as `MotionSetting`, but it also saves `reducedMotion`); haptics; display name.
- **Pay**: switch, currency (TZS default), default hourly rate through `toMinor`/`formatMinor`, "Estimates only". Changing currency re-reads the typed amount; nothing is ever converted.
- **Places**: rename and change radius inline, forget (with a confirm). Add from "Use my current location" (`captureLocation`, event `retry`, truthful failure copy) or from up to 5 recent unnamed clock-in fixes.
- **Privacy**: clock-in/out location switches. A list of every captured point with session date, time (zone abbreviation when it isn't the device's), accuracy and place; a show-coordinates toggle; delete per point; "Delete all" (confirm). Retention 30/90/365/Keep; when the new value would delete points, it asks first, then calls `applyRetention()`. The copy covers no background tracking, no third-party geocoding and share images without location.
- **Your data**: JSON backup (trash included), sessions CSV and day allocations CSV, each with a "Leave out precise location" option, downloaded as a Blob. Each export records `addActivity({ id: "export:"+Date.now(), type: "export", key: today })`, which earns Data Keeper. Import runs a dry run (`planImport` with `import_session` events, fresh UUIDs, `store.now()`, `deviceTimeZone()`), shows counts, conflicts with reasons and unreadable entries, then `store.record` for each session added after you confirm. The printable month report uses a print stylesheet scoped with `:has()`: only the report prints, ink on white.
- **Account**: explains device mode and persistent-storage status. Sync states covered: unconfigured, not signed in, signed out, attach pending (upload button), foreign data, and account (last synced, Sync now). Sign out warns when `sync.pending > 0`, then runs `wipeDevice()` and the `signOut` server action. "Erase this device" needs ERASE typed. `AccountData` is mounted only when signed in.
- **This device**: `<InstallGuide />` and `<PlatformCapabilities />` from the PWA lane (allowing notifications there sets `settings.notifications`), the iPhone lock-screen note, and the demo control.
- **Notifications switch**: `requestNotifications()` from the tap, with state from `notificationSupport()`. When `needsInstall`, the switch is disabled and the copy says iPhone reminders need the home-screen app.

## IMPORTANT DECISIONS
| Decision | Why |
| --- | --- |
| Settings split into 8 sub-routes, not only the 5 in SCREEN_LANES | Doctrine settings shell (menu on phones, side nav ≥1024). All sit under `/settings/*`, so they're public device-shell paths. Desktop `/settings` renders Your sessions |
| `/settings/account` is now a static client page (was `requireSession()`) | Device mode must work signed out; server pages can't read IndexedDB |
| `/api/team/**` routes kept, plus `api-client` team calls | `tests/team-routes.test.ts` imports them. Only the page and `components/team` were deleted |
| `MotionSetting` not mounted; an identical SwitchRow saves `reducedMotion` too | `MotionSetting` has no `onChange` and theme files aren't mine |
| Celebration seen list is read once when ready; achievements earned while the page is open still celebrate | One celebration per code per device; demo can't hide real celebrations |
| Retention change confirms when it would delete points now | Deletion can't be undone |
| Import adds sessions only (no settings, places or companion) | Never overwrite this device's profile; the copy says so |
| Untitled sessions show `smartTitle` ("Evening shift at Office") via `sessionLabel` | Same default as the rest of the app, instead of "Session" everywhere |

## DEPENDENCIES
- Uses (read-only): `@/lib/store/{react,store,rewards}`, `@/lib/rewards`, `@/components/mochi/*`, `@/components/theme/*`, `@/lib/export`, `@/lib/reports`, `@/lib/geo/*`, `@/lib/notify`, `@/components/pwa/{install-guide,capabilities}`, `@/lib/auth-actions` (`signOut`), `@/lib/supabase/env` (`supabaseConfigured`), `@/components/account/account-data`.
- Merged into this lane: `claude/relaxed-davinci-y8k5u9` twice (PWA lane, then the store fixes that bring home/sessions lane work). My temporary `useReadyShift` workaround was removed after the `getServerSnapshot` fix.

## KNOWN RISKS
- The theme is still read from localStorage at first paint. Saved `settings.theme`/`accent` from another device don't re-apply locally until chosen again (provider is ux-owned).
- `signOut()` redirects to `/login`. The device is wiped before the server sign-out; if that call then fails, the session stays signed in and the next sync pulls the account back. Not tested against a live Supabase project (A01: no SHIFTY project yet).
- Account screen states other than device/demo were checked by reading the code only. `attach_pending`, `foreign_data`, `account` and `signed_out` need a configured Supabase.
- Notifications: headless Chromium denies permission, so only the disabled/denied paths were seen. Granting, and the iPhone `needsInstall` copy, are unverified on real devices.
- The printable report's sessions table shows each session's full net; month totals count only the hours inside the month (footnote says so).
- No iPhone or Android device run. Headless Chromium only.

## TESTS RUN
| Command / check | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npx vitest run` | PASS: 37 files, 355 tests (24 new in `tests/settings-helpers.test.ts` and `tests/companion-helpers.test.ts`) |
| `npx next build` (Turbopack, hard-linked node_modules) | PASS before the final merge: `/companion` and all 9 `/settings*` routes prerender as static. Not re-run after merging the store fixes |
| Screenshot sweep (`screenshots/sweep`, gitignored) | 13 pages × 375/390/430/768/1024/1280 × light/dark = 156 shots: 0 console/hydration errors, page and `<main>` scrollWidth = viewport. After the final merge: 11 pages × 390/1280 × both themes, same result |
| Playwright flow (demo + fresh device) | Backup/CSV downloads; demo re-import plans "0 to add, 56 already here"; fresh device imports 56 → "Added 56 sessions"; export earns Data Keeper and celebrates once; equip beanie and rename persist; timezone search "dar" → Dar es Salaam; goal 49h refused with the sentence; ERASE wipes to 0 sessions; 0 page errors |
| Print media emulation | Only the report prints, black on white |

## NEXT AGENT ACTION
- Orchestrator: merge `lane/companion`.
- ux-architect (optional): give `MotionSetting` an `onChange` so Settings can mount it. Consider applying `settings.theme`/`accent`/`reducedMotion` from the profile when they arrive from sync.
- QA: real iPhone (installed and in Safari) for notifications copy, the install guide and safe areas. Run the account states against a configured Supabase project once A01 is resolved.
