# Handoff — ux-architect (lane/ux)

| Field | Value |
| --- | --- |
| AGENT | ux-architect |
| TASK | SHIFTY design tokens, shared primitives, session-free app shell, placeholder pages, `/design` style guide, icon set |
| COMMIT | `5c4e72b` feat(ui): design system, shell and primitives · follow-up `fix(ui)` + this handoff |

## FILES CHANGED
| Area | Files |
| --- | --- |
| Tokens | `src/app/globals.css` |
| Root | `src/app/layout.tsx` (Outfit + Geist, metadata, theme-color both schemes, `data-accent`) |
| Appearance | `src/lib/theme.ts`, `src/components/theme/theme-provider.tsx`, `src/components/theme/theme-setting.tsx` |
| Primitives | `src/components/ui/{button,card,stat-tile,segmented-control,status-pill,sheet,dialog,confirm-dialog,skeleton,empty-state,field,input,textarea,label,select,switch,slider,tooltip,sonner,progress-ring}.tsx` |
| Shell | `src/app/(app)/layout.tsx`, `src/components/shell/{topbar,bottom-nav,sidebar,nav-icon,page,page-loading,slots,brand-mark}.tsx`, `src/lib/nav.ts`; deleted `workspace-switcher.tsx` |
| Pages | `src/app/(app)/{page,sessions/page,insights/page,companion/page,settings/page,design/page,design/design-system}.tsx`; `dashboard/page.tsx` → redirect to `/`; deleted `src/app/page.tsx` |
| Auth shell | `src/app/(auth)/layout.tsx` |
| Icons | `public/icons/*.png`, `src/app/{icon.png,apple-icon.png,favicon.ico}` |
| Tests | `tests/ui-primitives.test.ts` |

## WHAT WAS IMPLEMENTED
- Two designed themes: ink dark (`#0c0a18` / `#151228` / `#1d1938`) and cream light (`#fbf8f1` / `#fff` / `#f4efe4`); accents lilac (default), indigo, teal, peach on `<html data-accent>`; semantic success / celebrate / danger / info / warning, each with `-soft` and `-ink`.
- Tokens: `bg-card`, `bg-raised`, `border-border(-strong)`, `text-muted-foreground`, `brand`, `brand-strong`, `brand-soft`, `primary`/`primary-foreground` (button fill, AA), `glow`, `track`, `rounded-card` (22px phones / 18px ≥1024), `rounded-control` (14px), `shadow-card|raised|primary|nav`.
- Type: Geist body (15px phones / 14px ≥768 via `text-sm`), Outfit display. Presets: `type-hero` (64–88px timer, tabular), `type-display`, `type-title`, `type-stat`, `type-eyebrow`; utilities `tabular`, `focus-ring`, `pt/pb/px-safe`, `animate-live`.
- Motion: `prefers-reduced-motion` and `<html data-motion="reduce">` both stop animation; `motion-safe:`/`motion-reduce:` variants honour both; `useTheme().reducedMotion` for JS.
- Shell (no session reads, fully prerendered): phones/tablets get a top bar (title + `SyncStatusSlot`) and a floating 5-tab bottom bar (Home · Sessions · Insights · Companion · Settings). From 1024px: a 232px sidebar with the brand and legal links, a slim top bar, content up to 1200px. `ActiveRibbonSlot` mounts once (CSS `order`): above the bottom bar on phones, under the top bar on desktop. Skip-to-content link.
- `/design` living style guide (not in nav): appearance switches, hero mock (ring + timer + Clock out), overage ring, tokens, type, buttons, pills, segmented, stat tiles, forms, sheet/dialog/confirm/toast, skeleton, empty, cards.

## IMPORTANT DECISIONS
| Decision | Why |
| --- | --- |
| 5 equal tabs, Home first, in a floating rounded bar; no raised centre button | Brief order puts Home first; a raised centre would be Insights. The Clock in action is the big `xl` button on Home instead |
| Bottom bar below 1024px (tablets too), sidebar from 1024px | 768 portrait tablets are held like phones |
| Bottom bar in the flex column, not `position: fixed` | Content and keyboard never hide behind it |
| Page `<h1>` lives in `PageHeader`; hidden on phones (`max-lg:sr-only`) because the top bar shows the title (aria-hidden there) | One heading per page, no duplicated title on phones |
| Dark `primary` (button fill) is `#6d5dfc` with white text, while `brand` (rings, icons, links) is `#8b7bff` | `#8b7bff` + white is 3.3:1 (fails AA); `#6d5dfc` is 4.54:1 |
| Teal/peach dark accents use dark text on the fill | Those hues can't hold white text at AA |
| Display sizes are `type-*` utilities, not `text-*` | `tailwind-merge` would treat `text-title` as a color and drop it |
| `Select` is native | Phones get the system picker |
| Hours deltas in `StatTile` default to neutral sentiment | More hours isn't "better" (brief: overage neutral, XP never grows with hours) |
| Sync "local" label = "On this device" | Plainer than "Local"; pass `label` to override |

## Primitive API (stable from 5c4e72b; additive changes only)
| Component | Props |
| --- | --- |
| `Button` (`@/components/ui/button`) | `variant`: primary (default) · secondary · soft · ghost · outline · danger · link (+ aliases default, destructive) · `size`: sm · md (default) · lg · xl · icon-sm · icon · icon-lg (+ aliases default, xs, icon-xs) · `asChild` · all `<button>` props; `type` defaults to `"button"` |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | Card: `variant` default · raised · hero · ghost, `padding` none · sm · md (default) · lg, `interactive` · CardHeader: `action?` · CardTitle: `as?` h2 · h3 · p |
| `StatTile` | `label`, `value`, `unit?`, `delta?: { value, direction: up · down · flat, sentiment?: positive · negative · neutral, label? }`, `hint?`, `icon?`, `href?`, `variant?`: card · raised, `className?` |
| `SegmentedControl<T>` | `value`, `onValueChange(value: T)`, `options: { value, label, icon?, ariaLabel?, disabled? }[]`, `ariaLabel`, `size?`: sm · md, `fullWidth?`, `className?` (radio group, arrow keys) |
| `Pill`, `StatusPill`, `SessionStatusPill`, `SyncStatePill`, `TONES`, `SESSION_STATUS`, `SYNC_STATE` | Pill: `tone?` neutral · accent · success · celebrate · info · warning · danger, `dot?`, `live?`, `icon?`, `size?`: sm · md · StatusPill: `label`, `tone?`, `live?` · SessionStatusPill: `status`: active · on_break · completed · SyncStatePill: `state`: local · syncing · synced · needs_attention, `label?` |
| `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetBody`, `SheetFooter`, `SheetClose` | SheetContent: `side?` responsive (default: bottom sheet on phones, right drawer ≥768) · bottom · right · left, `showCloseButton?` |
| `Dialog` family | Radix API; `DialogContent showCloseButton?` (bottom sheet on phones, centred ≥768) |
| `ConfirmProvider` / `useConfirm()` | unchanged: `confirm({ title, description?, confirmLabel?, cancelLabel?, destructive? }) → Promise<boolean>`; mounted in the (app) layout |
| `Skeleton` | div props |
| `EmptyState` | `title`, `description?`, `action?`, `icon?`, `variant?`: card · inline |
| `Field` | `label`, `htmlFor`, `hint?`, `error?`, `optional?`; ids `${htmlFor}-hint` / `${htmlFor}-error` |
| `Input`, `Textarea`, `Select`, `Label` | native props; `fieldClass` exported from input |
| `Switch`, `SwitchRow` | Radix Switch (`role="switch"`) · SwitchRow: `id`, `title`, `description?` + switch props |
| `Slider` | `value?`, `defaultValue?`, `onValueChange?(n)`, `min`, `max`, `step`, `aria-label` (required), `valueText?` |
| `Tooltip` | `content`, `children` (trigger), `side?`, `delayDuration?` |
| `Toaster` | sonner props; mounted in the (app) layout; use `toast` from `sonner` |
| `ProgressRing` (+ `ringGeometry`) | `value` (0..1, capped), `overage?` (fraction of goal, own inner arc in celebrate), `label` (required), `valueText?`, `size?` (232), `thickness?`, `tone?` brand · success · celebrate · info, `glow?` (true), `halo?`, `children` (centre), `className?` — server-safe, no client JS |
| Shell: `Page`, `PageHeader`, `PageSection` (`@/components/shell/page`) | Page: `width?` default · narrow · PageHeader: `title`, `description?`, `actions?` · PageSection: `title?`, `action?` |
| Slots (`@/components/shell/slots`) | `SyncStatusSlot`, `ActiveRibbonSlot` return null; TODOs name `@/components/sync/sync-status` and `@/components/session/active-ribbon` |
| Theme (`@/components/theme/*`) | `useTheme()` → `theme, resolvedTheme, setTheme, accent, setAccent, motion, setMotion, reducedMotion` · `ThemeSetting`, `AccentSetting` (`onChange?` to persist), `MotionSetting` |

## DEPENDENCIES
- Device mode needs `/`, `/sessions`, `/insights`, `/companion`, `/settings`, `/design` in `PUBLIC_PATHS` (`src/lib/public-paths.ts`, not mine). Today the proxy still redirects signed-out visitors to `/login`; `tests/public-paths.test.ts` expects `/` to be private and must change with it.
- `src/proxy.ts` throws when `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` are unset, so device mode without Supabase isn't reachable yet (owner of proxy).

## KNOWN RISKS
- Turbopack can't resolve the symlinked `node_modules` in worktrees. `next build` passed here only with a hard-linked copy (`cp -al`) in place of the symlink. The symlink is restored.
- Tailwind's auto source scan follows any non-ignored symlink in the repo root (a renamed `node_modules.link` broke the build). Keep links out of the root.
- `onboarding` / `create-workspace-form` still push to `/dashboard`, which now redirects to `/`.
- Template screens (auth forms, team, account) use fixed pixel sizes; phones remap them in `globals.css`. They pick up the new tokens but weren't redesigned.
- Light-mode input borders (`--input`) are below 3:1 against white. The filled `bg-raised` field marks the control.
- Sheets autofocus the first field (Radix default). Lanes can `onOpenAutoFocus={e => e.preventDefault()}` to avoid opening the phone keyboard.

## TESTS RUN / RESULTS
| Command | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npx vitest run` | PASS: 18 files, 99 tests (incl. `tests/ui-primitives.test.ts`: ring capping/overage, tone map, nav order/titles, no-flash script) |
| `npx next build` | PASS on the first commit's tree (hard-linked node_modules). Not re-run after the follow-up class-only fixes |
| Playwright screenshots (`screenshots/`, not committed) | `/design` and `/` at 375 / 390 / 430 / 768 / 1024 / 1280, light + dark; sheet, confirm, toast at 390 dark and 1280 light. No page-level horizontal overflow at any width |

## NEXT AGENT ACTION
- Orchestrator: add the device-mode public paths (and make the proxy tolerate missing Supabase env), then merge lane/ux before the screen lanes.
- Home lane: replace `src/app/(app)/page.tsx` with `ProgressRing value/overage halo` + `type-hero tabular` timer + `Button size="xl"` Clock in / Clock out.
- Sync lane: fill `SyncStatusSlot` with `SyncStatePill`. Session lane: fill `ActiveRibbonSlot`.
- Settings lane: mount `ThemeSetting` / `AccentSetting` / `MotionSetting` with `onChange` that persists to user_settings.
