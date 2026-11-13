# Handoff — redesign lane R0 (Foundation)

| Field | Value |
| --- | --- |
| AGENT | ux-architect |
| TASK | Lane R0 of `factory/REDESIGN.md`: install the factory's design system, convert everything shared, mark what is not converted, plan every screen |
| BRANCH | `lane/r0-foundation` (from `origin/redesign` @ `038070f`) → PR #11 into `redesign`: https://github.com/mafiabossbill/shifty/pull/11 |
| COMMITS | `7ecf489` (code), `f9d7568` (docs), then this line |
| DATE | 2026-11-13 |
| RAN ON | Bill's Mac (main checkout), not the cloud. No `.env`; device mode only. No database work of any kind |

## 1. What changed
| Area | Files | What |
| --- | --- | --- |
| Tokens | `src/app/globals.css` | Rewritten from the factory reference: seven type sizes with Tailwind's switched off, three shadows with Tailwind's switched off, four corner sizes with the rest switched off, `--control` (3.36:1 light, 3.81:1 dark), light by default and a near-black dark theme, flipped status scales in dark, one focus ring. No gradient, no glow. Kept from SHIFTY: `motion-safe`/`motion-reduce` variants that honour Settings → Reduce motion, safe-area utilities, the 44px touch rule. New: `px-page`, `logo-*` |
| Merge | `src/lib/utils.ts` | `cn()` knows the type-scale and elevation names; exports `TYPE_SCALE`, `ELEVATIONS` |
| Check | `scripts/design-check.ts` (copied as is), `scripts/design-shots.ts`, `tests/design.test.ts`, `package.json` (`design:check`, `design:shots`), `.gitignore` (`/factory/screens/`) | The check runs inside `npm test`. The test also checks marker ownership, retired names and contrast (D21) |
| Primitives | `src/components/ui/**` | All 22 files converted; `progress-bar.tsx` is new. 0 findings, no marker |
| Shell | `src/components/shell/**`, `src/app/(app)/layout.tsx`, `src/app/(app)/error.tsx` | Flat sidebar (224px), top bar (50px) that names the place on every width, flat five-tab bottom bar, `Page` / `PageHeader` / `PageSection`, `SkipLink`, `PageLoading` |
| Theme | `src/lib/theme.ts`, `src/components/theme/**`, `src/app/layout.tsx` | Browser colours are white and `#0c0e15`; Outfit removed; `data-accent` removed (D13) |
| Sign-in | `src/app/(auth)/**`, `src/components/auth/**` | `AuthFrame`, `AuthHeading`; forms use `Field`; the server's answer sits at the top of the form |
| Legal | `src/app/(legal)/**` | Reading size (18/28), `max-w-prose`, no box; the cookie table is a list |
| Other pages | `src/app/no-access/page.tsx`, `src/app/not-found.tsx`, `src/app/global-error.tsx` | Converted. The last two are owned by no lane and are error pages, so R0 took them |
| Gallery | `src/app/design/**`, `src/components/design/**`, `src/lib/design-gallery/**`, `src/lib/public-paths.ts`, `tests/public-paths.test.ts` | `/design` (system page) and 11 shared pages; development only (404 in a production build, not public there). The old `src/app/(app)/design` is deleted |
| Markers | 67 feature files + 3 Mochi drawing files | See §6 |
| Plans | `factory/PRODUCT_BLUEPRINT.md` § Screens | A plan for every signed-in screen, and the rules they share |
| Docs | `CLAUDE.md` (UI rules, commands), `factory/DECISIONS.md` (D11 to D21), `factory/REDESIGN.md` (Log) | |

## 2. Decisions
All in `factory/DECISIONS.md`. The ones a lane will meet:

| # | Decision |
| --- | --- |
| D13 | **The accent setting no longer colours anything.** `AccentSetting` still stores the value so `/settings/appearance` keeps working; the plan for that screen removes the row. This is the one place R-D5 overrides R-D1: **it needs Bill's nod before R5 starts** |
| D14 | Five status tones. Clocked in = `info`, On break = `warning`, Completed = `success`. No `accent`, no `celebrate`, no pulsing dot |
| D15 | Goal progress is `ProgressBar`. `ProgressRing` is retired but still in the folder until R1 and R2 stop importing it |
| D16 | One focus ring from `globals.css`; components draw none |
| D17 | `Card` is one flat box; `StatTile` has no box; `EmptyState` has no icon |
| D18 | Five tabs in the bottom bar |
| D19 | The top bar names the place; `PageHeader`'s `<h1>` is for screen readers; `Page` starts at the left edge (not centred) |
| D20 | Gallery screens use the app's demo store through its public API |
| D12 | Smaller ones: one typeface, `lg` is the largest button, switch and segmented control are neutral, the Companion icon is a face |

## 3. Renames (feature lanes depend on this list)
`tests/design.test.ts` fails a file that uses a retired name once its `awaiting redesign` marker is removed. Tailwind draws **nothing** for a class it does not know, so until a file is converted these classes are simply missing on screen.

### Classes and tokens
| Retired | Use instead |
| --- | --- |
| `type-hero`, `type-stat`, `type-display` | `text-display font-semibold tracking-tight tabular-nums` (a key number). Nothing is larger |
| `type-title` | `text-title font-semibold` |
| `type-eyebrow` | `text-caption text-muted-foreground`, sentence case |
| `text-2xs` | `text-caption` (`text-micro` is for the phone tab bar only) |
| `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`…, `text-[13px]` | `text-caption` (12/13px), `text-body` (14/16px, the default: usually write nothing), `text-title`, `text-prose`, `text-heading` |
| `font-medium`, `font-bold` | `font-semibold`, or nothing |
| `font-display` | Nothing: one typeface |
| `tabular` | `tabular-nums` |
| `tracking-wide`, `uppercase` | Nothing. `tracking-tight` only on `text-heading` and `text-display` |
| `rounded-card` | `rounded-lg` |
| `rounded-control` | `rounded-md` |
| `rounded-2xl`, `rounded-[18px]`… | `rounded-lg` (box), `rounded-md` (control), `rounded-sm` (pill), `rounded-xl` (sheet), `rounded-full` (dot) |
| `shadow-card`, `shadow-primary`, `shadow-nav`, `shadow-md`… | No shadow: boxes sit flat. `shadow-raised` only on a control, `shadow-overlay` on a menu or toast, `shadow-modal` on a dialog or sheet |
| `focus-ring` | Nothing: every focusable element gets the ring |
| `animate-live` | Nothing |
| `bg-raised` | `bg-muted` (a quieter surface) or nothing |
| `border-border-strong` | `border-control` (an edge that carries meaning) or `border` |
| `bg-track`, `stroke-track` | `bg-neutral-200`, `stroke-neutral-200` |
| `text-brand`, `bg-brand`, `stroke-brand`, `ring-brand` | `text-foreground`; a fill is `bg-neutral-800`; an action is `bg-primary` (the Button does that) |
| `bg-brand-soft text-brand-strong` | A selection: `bg-accent text-foreground` plus a second cue (weight, a check). A status: a `Pill` |
| `bg-success-soft text-success-ink` | `bg-emerald-50 text-emerald-700` (`Pill tone="success"`) |
| `bg-celebrate-soft text-celebrate-ink` | `bg-amber-50 text-amber-800` only if it means "waiting"; otherwise neutral |
| `bg-warning-soft text-warning-ink` | `bg-amber-50 text-amber-800` (`Pill tone="warning"`) |
| `bg-danger-soft text-danger-ink`, `text-danger` | `bg-red-50 text-red-700` (`Pill tone="danger"`); an error sentence is `text-red-700` with an icon |
| `bg-info-soft text-info-ink` | `bg-blue-50 text-blue-700` (`Pill tone="info"`) |
| `bg-glow`, `var(--glow)`, any gradient | Nothing |
| `var(--brand)`, `var(--r-card)`, `var(--elev-*)`, `var(--type-*)` | A token that exists in `globals.css` |
| `<html data-accent>`, `[data-accent=…]` | Gone |
| Spacing off the scale (`p-5`, `gap-2.5`, `h-13`…) | `0.5 1 1.5 2 3 4 6 8 12 16 20 24` |

### Components
| Was | Now |
| --- | --- |
| `Button variant="primary"` (default) | `variant="default"` (still the default) |
| `Button variant="secondary"`, `"soft"` | `variant="outline"` |
| `Button variant="danger"` | `variant="destructive"`, and only as the confirm button. **At rest a delete is `outline` or `link`** |
| `Button variant="link"` | Kept: now underlined, no side padding |
| `Button size="md"` | `size="default"` (32px, 40px on phones) |
| `Button size="xl"`, `"icon-lg"` | `size="lg"` (36px, 44px on phones), `size="icon"` |
| `Card variant="default"·"raised"·"hero"·"ghost"` | No `variant`. One flat box. `padding="none"·"sm"·"md"·"lg"` and `interactive` stay |
| `StatTile variant`, `icon` | Removed. No box; `href` adds a chevron and underlines the value on hover |
| `EmptyState icon` | Removed. `variant="card"·"inline"` stays |
| `Pill size`, `live`; `SessionStatusPill size`; `SyncStatePill size`; `StatusPill live` | Removed: one size, nothing pulses |
| `Pill tone="accent"` | `tone="info"` |
| `Pill tone="celebrate"` | `tone="warning"` (only if it means waiting) or `neutral` |
| `ProgressRing tone`, `glow`, `halo` | Removed. The ring itself is retired: use `ProgressBar value overage label valueText` |
| `Field htmlFor` (required) | Optional. With one control as the child, `Field` sets `id`, `aria-describedby` and `aria-invalid` itself. Hint and error now sit **above** the control; "Optional" reads "(optional)" |
| `ACCENT_SWATCHES` (`@/lib/theme`) | `ACCENT_LABELS` (names only) |
| `TopBarFrame()`, `BottomNavFrame()` | Take `pathname` (`null` = not known yet); `TopBarFrame` takes children for the right side |
| `PageHeader` | Same props. The `<h1>` is never visible; description and actions are |
| `Page` | Same props. `default` 1152px, `narrow` 672px, both left-aligned |
| Sizes | Field and default button: 32px, 40px on phones (was 40/44). Touch hit areas are still at least 44px |

## 4. Mechanical edits made in feature files
Only what the build needed after a rename; no restyling. 28 files, besides the marker line:

| Edit | Files |
| --- | --- |
| `variant="secondary"` / `"soft"` → `"outline"`; `"danger"` → `"destructive"` | `companion/xp-log`, `home/active-hero`, `home/recap-sheet`, `insights/chart-kit`, `hours-ring`, `insights-screen`, `session-breakdown`, `share-recap`, `summary-cards`, `sessions/edit-times-sheet`, `list-toolbar`, `location-section`, `manual-entry`, `rezone-sheet`, `session-detail`, `sessions-screen`, `times-form`, `trash-screen`, `settings/account-settings`, `data-settings`, `demo-link`, `places-settings`, `printable-report`, `privacy-settings`, `timezone-picker`, `sync/sync-sheet` |
| `size="xl"` → `"lg"` | `home/clock-in-hero` |
| `Card variant=…` removed. Where it was `hero`, `overflow-hidden` is added to the class, because that variant clipped its content (without it Insights scrolled sideways on phones) | `home/active-hero`, `home/clock-in-hero`, `insights/hours-ring`, `insights/insights-screen`, `sessions/session-detail` |
| `StatTile variant="raised"` removed | `insights/session-breakdown`, `insights/summary-cards` |
| `EmptyState icon=…` removed, and the icon import with it | `insights/insights-screen`, `session-breakdown`, `summary-cards`, `sessions/session-detail`, `sessions-screen`, `trash-screen`, `settings/places-settings`, `privacy-settings` |
| `Pill` `size`, `live` removed; `tone="accent"` → `"info"` | `home/active-hero`, `insights/hours-ring`, `sessions/badges` |
| `ProgressRing` `tone`, `halo`, `glow` removed | `home/active-hero`, `sessions/session-detail` |

Still red at rest after the rename (each lane makes them quiet): `sessions/session-detail` (Delete forever), `settings/account-settings` (Erase this device, Delete my account), `settings/privacy-settings` (Delete all).

## 5. Gallery: how to add a page
1. **Page**: `src/app/design/screens/<area>/page.tsx` renders the real screen in `GalleryScreen`:
   ```tsx
   import { GalleryScreen } from "@/components/design/gallery-screen";
   export default function Page() {
     return <GalleryScreen pathname="/sessions"><SessionsScreen /></GalleryScreen>;
   }
   ```
   `pathname` is the screen's real route (the nav item and the top bar follow it). The default sample is the demo history (ten weeks, `src/lib/demo/seed.ts`).
2. **Other states**, each its own folder: `…/<area>/empty/page.tsx` with `sample="empty"`; any other state with `prepare`, which drives the store with its own actions (the page then needs `"use client"`):
   ```tsx
   <GalleryScreen pathname="/" prepare={async (store) => { await store.clockIn(); await store.startBreak("meal"); }}>
   ```
   Sample values that stress the screen (longest title, missing value) go through the same actions (`store.manualCreate({...})`, `store.annotate(id, {...})`); keep helpers in `src/components/design/<area>-samples.ts`.
3. **Register** in your area's file only (`src/lib/design-gallery/<area>.ts`): replace `awaiting("R2")` with `{ gallery: "/design/screens/sessions", states: ["default", "empty", "filtered"] }`. The first state is `default`; state `x` lives at `<gallery>/x`. `tests/design.test.ts` fails if a listed page is missing.
4. **Look**: `npm run design:shots -- --only /design/screens/sessions` writes `factory/screens/*.png` at 375 and 1280, light and dark. Open them.

Good to know: nothing a gallery page does is saved or synced (in-memory store, no transport). One store per tab: links between gallery pages must be plain `<a href>`; a page reached another way reloads itself once. The full sample is dated from today, so images change from day to day. A `?param` the screen reads cannot be in a registered route: give the component an optional prop for the gallery (as `LoginForm initialState`) or set it in `prepare` with `window.history.replaceState`. `GalleryShell ribbon={false}` leaves out the active-session ribbon. On this Mac: `E2E_CHROMIUM_PATH="$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-1208/*/chrome-headless-shell)"` works with Playwright 1.64.

## 6. Markers
`// design-ok-file: awaiting redesign lane R<n> (<area>)` on every unconverted file that has findings or uses a retired name:

| Lane | Files |
| --- | --- |
| R1 (home) | 9 |
| R2 (sessions) | 18 |
| R3 (insights) | 12 |
| R4 (companion) | 11 |
| R5 (settings) | 17 |
| **Total** | **67** |

Standing exceptions (not markers): `mochi/mochi.tsx`, `mochi/habitat.tsx`, `mochi/parts.ts` (R-D4); `app/global-error.tsx` (replaces the root layout, so no stylesheet); one line each in `lib/theme.ts` (browser colours must be literals) and `lib/app-config.ts` (the brand colour as data).

## 7. Verified
| Check | Result |
| --- | --- |
| `npm run check:full` | PASS (lint 0 problems, typecheck, 43 files / 416 tests, build) |
| `npm run design:check` | 0 errors, 2 warnings (centred text in `EmptyState` and the retired ring), 930 documented exceptions: 567 in the 67 files awaiting their lane, 357 in Mochi's three drawing files, 6 standing (`global-error.tsx` 3, `theme.ts` 2, `app-config.ts` 1) |
| Contrast (in the test) | `--control` 3.36:1 light, 3.81:1 dark (3.58 on a card); muted text 5.06 / 7.48; focus ring 7.44 / 9.62; white on the red button 4.79 / 5.58 |
| Production build | `next start`: `/design`, `/design/shell`, `/design/auth/sign-in`, `/design/overlays/dialog` → 404; `/`, `/sessions`, `/login`, `/privacy` → 200 |
| `npm run design:shots` | 68 images (12 gallery pages + 5 public pages × 2 widths × 2 themes), opened and reviewed |
| The app itself (`/?demo=1`, device mode) | `/`, `/sessions`, `/sessions/new`, `/insights`, `/companion`, `/settings`, `/settings/appearance` load at 375 and 1280 with no console or page errors |
| Browser specs (`npm run test:e2e`, local dev server, device mode, all three widths) | 125 of 134 pass, 4 skip. The 9 that fail fail the same way on untouched `origin/redesign`: `offline.spec.ts` (2 tests × 3 widths: the service-worker journeys time out against a dev server) and `sweep: public pages` (× 3: with no backend the sign-in layout shows "Sync isn't set up" in place of the page, and Next's dev server logs a console error for the dropped page). `sweep: app routes` passes at every width, empty and demo data, light and dark: no sideways scroll, one `h1`, every control named, primary controls 44px. No spec was edited |

## 8. Design review
```
DESIGN REVIEW: PASS WITH NOTES
REVIEWER: ux-architect, lane R0 (built it: yes)
SCREENS LOOKED AT: /design, /design/overlays/dialog, /design/overlays/confirm, /design/overlays/sheet, /design/shell,
  /design/shell/empty, /design/shell/loading, /design/shell/error, /design/auth/sign-in, /design/auth/sign-in-error,
  /design/auth/sign-up, /design/auth/forgot-password, /login (device mode), /privacy, /cookies, /no-access, not-found
  at 375 and 1280, light and dark
DESIGN-CHECK: 0 errors, 2 warnings, 930 documented exceptions (567 awaiting a lane, 357 Mochi's drawing, 6 standing; each reason read: yes)
FINDINGS:
| Screen | Width / theme | § | What is wrong | Fix |
| /privacy and other legal pages | 1280 | 3 | Section titles (16px) are smaller than the reading text (18px) they head; weight carries them | Left as the standard's `text-title`; R6 to judge |
| /design (States) | all | 12 | The dashed edge of an empty state and a pulsing skeleton are faint in light | Decorative border by design; left |
| Unconverted feature screens | all | 1 | Home's clock button overlaps its ring; old classes draw nothing | Expected until R1 to R5 land |
| /settings/appearance | all | 1 | The Accent control changes nothing | D13: R5 removes the row once Bill agrees |
NOT REVIEWED: every signed-in feature screen (exempt in the registry: awaiting redesign lane R1 to R5); the toast, menu and
  tooltip only on the system page's live demos, not held open in a photograph; /reset-password, /onboarding, /terms,
  /data-deletion (same components as the pages above).
```
Found by looking and fixed before this handoff: page-header actions floating mid-row on desktop and squeezed beside the description on phones; a centred narrow column that lined up with nothing; the logo's tile vanishing on the dark sidebar; the link button indented by its padding.

## 9. Not finished, and asks
| For | What |
| --- | --- |
| Bill, through the orchestrator | **D13**: agree that Appearance → Accent goes (the saved value stays). Until then the row is a control that does nothing |
| Orchestrator | After R1 and R2 land: delete `src/components/ui/progress-ring.tsx` and its two tests in `tests/ui-primitives.test.ts` (R0's files). `PRODUCT.md` still describes the old look (§ Non-functional "Look", § Screens) and `/sessions/[id]`: update it in the release PR. `src/lib/nav.ts` (no owner) still lists a title for `/design`, now unused |
| R1 | The ribbon, sync pill and demo banner are yours and sit in the shell on every page: convert them first. `SyncStatus` draws its own loading placeholder with retired classes |
| R4 | `src/components/mochi/gallery.tsx` is not a drawing file: it is an unused pose sheet with its own colours and capital labels. Turn it into gallery pages or delete it. If a state needs Mochi mid-celebration, check what `prepare` can reach |
| R5 | `src/components/workspaces/create-workspace-form.tsx` is used by `/onboarding` (R0's page) but is yours: it still has a local label and a red 13px error; convert it with `Field` |
| R6 | Toasts, menus and tooltips were looked at live on `/design`, not in photographs. Legal section titles (above) |
| Anyone | A gallery state the store's actions cannot reach needs a change under `src/lib/store`, which nobody may edit: ask in a handoff |

## NEXT AGENT ACTION
Orchestrator: verify and merge this PR into `redesign`; get Bill's answer on D13; write briefs R1 to R5 from `factory/PRODUCT_BLUEPRINT.md` § Screens and §3 to §5 above; launch them together.
