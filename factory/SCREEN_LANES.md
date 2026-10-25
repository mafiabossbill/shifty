# Screen lanes — shared brief

Binding for the home, sessions, insights and companion-settings lanes. Product truth: `factory/BRIEF.md`, `PRODUCT.md`.

## Contracts you build on (read the code; do not edit these files)
| Need | Use | Notes |
| --- | --- | --- |
| Data + actions | `useShift()` (view), `useShiftStore()` (actions), `useNow(ms)` from `@/lib/store/react` | Client components only. `view.ready` false → render skeletons. Never compute elapsed with tick counting: always `sessionMetrics(session, now)` with `now = useNow()` |
| View fields | `src/lib/store/store.ts` `StoreView` | `sessions` (visible, newest first), `trash`, `active`, `state`, `profile` (settings, projects, places, activities, companion, ledger, achievements), `sync` (mode, phase, message, pending, attention[], lastSyncedAt, email), `sessionSync[id]`, `undo`, `demo`, `dismissedNudges` |
| Actions | `ShiftStore` methods | `clockIn(details?)`, `startBreak(kind)`, `endBreak()`, `clockOut()` (8 s undo: `undoClockOut()`), `retryLocation(id)`, `correct(id, {reason, expectedRevision, startedAt?, endedAt?, breaks?, allowOverlap?})`, `annotate(id, changes)`, `manualCreate({...})`, `rezone(id, zone, rev)`, `trash/restore/purge(id)`, `deleteLocation(id, fixId)`, `deleteAllLocations()`, `discard(eventId)`, `retry(eventId)`, `updateSettings(patch)`, `updateCompanion(patch)`, `saveProject`, `savePlace`, `removePlace`, `addActivity`, `dismissNudge`, `syncNow()`, `attachToAccount()`, `wipeDevice()`. They throw `ShiftActionError` (`.error.code`, `.error.message`, `.error.conflictingSessionId`) — show the message in a toast/inline, never swallow |
| Time math | `@/lib/time/allocate` (`sessionMetrics`, `allocateByDay`, `goalProgress`, `anchorDate`), `@/lib/time/zone` (local dates, `toWallClockInput`/`fromWallClockInput` for `<input type="datetime-local">` in the session's reporting zone) | Times shown in the **session's reporting zone**, with the zone abbreviation when it differs from the device zone |
| Reports | `@/lib/reports` | `sessionFacts`, `dailyTotals(facts, mode)`, `summarize`, `buckets`, `heatmap`, `clockInHours`, `durationStats`, `records`, `monthComparison`, `placeBreakdown`, `earnings`, `contributionsOn`, `rangeFor`, `shiftRange` |
| Rewards | `rewardsFor(state, profile, now)` from `@/lib/store/rewards` | Level, progress, achievements, rhythm, `summaryForSession(id)` for the recap |
| Mascot | `@/components/mochi/*` | `Mochi`, `Habitat`, `CATALOG`, `unlockedKeys`, `nextUnlocks`, `moodFor` |
| Formatting | `@/lib/format` | `formatStopwatch`, `formatDuration`, `spokenDuration`, `formatTime(instant, zone, clock)`, `formatDate`, `relativeDay`, `zoneAbbreviation`, `smartTitle`; money via `formatMinor` (`@/lib/money`) |
| Location copy | `LOCATION_STATUS_COPY` in `@/lib/geo/capture` | Truthful: "Location not captured — …" |
| Export | `@/lib/export` | `buildBackup`, `sessionsCsv`, `allocationsCsv`, `planImport` (import event type `import_session`) |
| UI | `src/components/ui/**`, `@/components/shell/page` (`Page`, `PageHeader`, `PageSection`), `/design` page | Handoff with every prop: `factory/handoffs/ux.md`. Don't restyle primitives; ask the orchestrator if one is missing (build a local component in your folder meanwhile) |

## Routes (static shells; data comes from IndexedDB)
| Route | Lane |
| --- | --- |
| `/` Home (+ `?action=clock-in` shortcut) | home |
| `/sessions`, `/sessions/view?id=<uuid>` (detail — query param, NOT a dynamic segment, so it works offline), `/sessions/new`, `/sessions/trash` | sessions |
| `/insights` (range + mode in the URL query) | insights |
| `/companion`, `/settings`, `/settings/privacy`, `/settings/data`, `/settings/account`, `/settings/places` | companion-settings |

Links between lanes use these URLs only (e.g. Home's "last session" links to `/sessions/view?id=…`; Insights drill-down links to `/sessions?ids=…` or `/sessions/view?id=…`; the Sessions list must accept `?ids=a,b,c`, `?date=YYYY-MM-DD` and `?q=` filters).

## Rules
- Phones first (375/390/430), then 768/1024/1280, both themes. Touch targets ≥44px, inputs ≥16px on phones, no sideways page scroll, safe areas.
- Big numbers in `type-hero`/`type-stat` + `tabular`. Calm motion; respect reduced motion.
- Every screen: loading skeleton (`!view.ready`), empty state (one sentence, one action), error text that says what to do.
- Never praise long hours; overage is shown neutrally ("+1h 12m past your goal").
- Demo mode (`view.demo`): the shell shows a banner (home lane builds `DemoBanner` in the ribbon slot area); everything else just works.
- Accessibility: charts get a text alternative/table; icons have labels; focus visible.
- Checks in your worktree: `npm run lint`, `npm run typecheck`, `npx vitest run`. Browser: `npx next dev --webpack -p <your port>` (Turbopack can't follow the symlinked node_modules), visit with `?demo=1` to get ten weeks of data, screenshot with Playwright (`require('playwright')`, `chromium.launch()`) at 390 and 1280 in both themes into `screenshots/` (gitignored), LOOK at them and iterate.
- Commit on your lane branch, conventional commits ending with the two attribution lines. Do not push. Handoff in `factory/handoffs/<lane>.md` (AGENT, TASK, FILES CHANGED, WHAT WAS IMPLEMENTED, IMPORTANT DECISIONS, DEPENDENCIES, KNOWN RISKS, TESTS RUN, TEST RESULTS, NEXT AGENT ACTION, COMMIT).
- Pure logic you add (filters, view models) goes in `src/lib/<lane>/` with unit tests in `tests/<lane>-*.test.ts`.
