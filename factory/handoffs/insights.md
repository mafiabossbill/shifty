# Handoff — frontend-engineer (lane/insights)

| Field | Value |
| --- | --- |
| AGENT | frontend-engineer (Insights lane) |
| TASK | `/insights`: range + mode controls, widgets A–L, single-session breakdown, weekly review, pure view models + tests |
| COMMIT | `cf52425` feat(insights) · merge `2aab8d5` (claude/relaxed-davinci-y8k5u9 store fixes) · follow-up `fix(insights)` with this handoff |

## FILES CHANGED
| Area | Files |
| --- | --- |
| Page | `src/app/(app)/insights/page.tsx` (static shell, `<Suspense>` around the client screen) |
| Screen | `src/components/insights/{insights-screen,insights-controls,use-insights}.tsx/ts` |
| Chart kit | `src/components/insights/chart-kit.tsx` (sizing, hover/tap/keys interaction, tooltip, card with Table toggle + empty + error boundary, data table) |
| Widgets | `hours-ring.tsx` (A) · `day-ribbon.tsx` (B) · `heatmap-card.tsx` (C) · `bars-card.tsx` (D) · `month-calendar.tsx` (E) · `patterns.tsx` (F, G) · `summary-cards.tsx` (H, I, J, K) · `share-recap.tsx` (L) · `session-breakdown.tsx` (`?session=`) |
| View models | `src/lib/insights/{params,labels,model,scale,radial,recap}.ts` |
| Tests | `tests/insights-model.test.ts`, `tests/insights-params.test.ts` |

## WHAT WAS IMPLEMENTED
- URL state: `?range=today|week|month|year|custom` (default week), `date=` (any date in a preset range), `from=&to=` (custom, ordered, capped at 3 years), `mode=start` (default calendar), `heat=7|30|90` (default 90), `session=<id>`. Defaults are left out of the URL. Prev/next use `shiftRange`; "Back to this week" appears when you're not on the current range; next is disabled once the range reaches today.
- Mode toggle (`SegmentedControl`) with a one-line example in the person's clock format. When a shift crosses the range edge, the hero shows the other mode's total and explains why it differs ("over all your sessions the two always add up to the same total").
- A. Hours in motion: 7 or fewer values → concentric day rings (a full ring is the goal, like Home's ring, capped); more → radial bars (per day; per week past 400 days) with a dashed goal circle and month/day labels. One soft glow. The centre is the readout for hover, tap and arrow keys. Includes the running session and updates every minute (`useNow(60000)`). A "Live" pill shows while it is running.
- B. Day-split ribbon: one connected band per session on an hours-from-local-midnight axis in the session's reporting zone. Segments split at real day boundaries (DST-safe via `nextDayBoundary`) and alternate brand / brand-45% by date. Breaks are gaps over a hairline. Axis labels avoid collisions. Shows the latest 31 sessions, with "View all".
- C. Heatmap 7/30/90: week rows from `settings.weekStart`, 5 brand levels, month labels, today outlined, future dashed.
- D. Bars: per day (Week, short custom), per week (Month, Year), per month (long custom). Breaks stack faintly on top. Dashed target step line = Σ goals of sessions anchored in each bar. The bar holding today is solid. Today shows "Last 7 days" for context, labelled so it isn't confused with the range total.
- E. Month calendar: real buttons. A ring marker shows where time came from an earlier-started shift (calendar mode only). The popover lists each contribution with a "from Thu 1 Oct 16:45" backlink to `/sessions/view?id=`.
- F. Clock-in strip, 24 bars, "~HH:MM typical start". The typical start is the circular mean of the busiest 3-hour cluster, so two habits don't average to a time in between. Shows "Varies" when the cluster holds under 40% of starts.
- G. Duration histogram (2h bins) with mean (solid) and median (dotted) markers.
- H. Records (8 tiles, neutral wording: "Most in one day", "Goal reached"). I. Month on month with a neutral delta sentence and neutral colours. J. Places bar list (place / "Unlabelled spot" / "Not captured"; no coordinates or maps; settings link when nothing was captured). K. Earnings per currency via `formatMinor`, labelled "Estimate — no overtime rules applied". Shown when pay tracking is on or any session has a rate.
- L. Share week/recap: dialog with a preview, "Include place names" switch (off by default), Share (`navigator.share({files})` when `canShare`) or Download. The SVG uses the live theme colours and renders to a 1080×1350 PNG.
- `?session=<id>`: one session's ribbon with per-day labels, stat tiles, and a per-date table whose total equals the session net. Separate empty states for trash and for "not on this device".
- Weekly review (Week range, week started): `store.addActivity({ id: "review:"+weekStart, type: "week_review", key: weekStart })`, then a "Reviewed" pill. Errors go to a toast.
- Every chart: loading skeleton, empty state (one sentence), error boundary ("This chart couldn't be drawn… Try again"), Table toggle (text alternative), focusable group with arrow keys and Esc, and drill-down links on every number (`/sessions?ids=`, `/sessions/view?id=`, `/sessions?date=`; `?from=&to=` past 500 ids).

## IMPORTANT DECISIONS
| Decision | Why |
| --- | --- |
| A full ring = the goal (rings); a full bar = the busiest value (radial bars) | Rings match Home's ring; bars need spread to show shape. Exact values are always in the readout and table |
| Hover shows a pass-through preview; click or tap pins the tooltip (its link becomes clickable); Esc or tapping outside closes it | One pattern on mouse, touch and keyboard. A preview never blocks reading the next mark |
| Heatmap rows are weeks (columns are weekdays from the week start) | The brief's "week rows by weekStart"; reads like a calendar on phones |
| Records "Sessions / Net / Breaks / Most in one day" follow the selected mode's range summary; "Longest", "Goal reached" and "Crossed midnight" count sessions started in the range | Keeps the hero, bars and records totals identical in both modes |
| Recap card has no gradient, system fonts | Calm. An SVG rendered as an image can't load web fonts |
| Hydration guard in the screen (`useSyncExternalStore` "hydrated" flag) | Added before the store fix landed. It is now redundant with `c3af1c1` but harmless |

## DEPENDENCIES
- Sessions lane `src/lib/sessions/query.ts` reads `ids` (max 500), `date`, `from`, `to`. Insights links depend on that.
- `/settings/privacy` and `/settings` are linked from the Places and Earnings empty states (companion-settings lane).

## KNOWN RISKS
- Long ranges (Year, 3-year custom) rebuild the model every minute while a session is running. Fine for the 10-week demo. Not profiled with thousands of sessions.
- Recap PNG uses system fonts, not Outfit/Geist.
- The month calendar popover is positioned in-card. On a 375px phone, a popover for a bottom-row date can extend below the card (it is never clipped).
- `next dev --webpack` has no Tailwind pipeline here. Screenshots were taken with Turbopack on a hard-linked `node_modules` (restored to the symlink afterwards).

## TESTS RUN
| Command | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npx vitest run` | PASS: 37 files, 354 tests (insights: 22 tests: empty data has no NaN anywhere in the model, both modes reconcile in every rendered total, range-edge difference, month/year crossings, ribbon midnight split, calendar backlinks, heatmap week start, typical start, scales, radial geometry, recap privacy + layout, URL round-trips, prev/next across month/year) |
| `npx next build` (Turbopack, hard-linked node_modules) | PASS; `/insights` static |
| Playwright `?demo=1` sweep | Week, Month, Year, Today, Custom, start mode, session view, empty profile at 390 / 430 / 768 / 1280, light + dark (64 shots in `screenshots/`). No page-level sideways overflow, no console errors |
| Playwright interactions | Desktop hover tooltip on bars, ribbon click tooltip, ring arrow keys, calendar popover backlink, share dialog (no place names until ticked, no coordinates ever), PNG download, weekly review → "Reviewed", phone tap tooltip |

## NEXT AGENT ACTION
- Orchestrator: merge lane/insights. QA: check on a real iPhone that the share sheet accepts the PNG.
- Optional: once the store guarantees the hydration snapshot everywhere, remove the `hydrated` guard in `insights-screen.tsx`.
