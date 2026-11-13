# DECISIONS — SHIFTY

> Architecture and product decisions that would surprise a newcomer. One entry per decision, newest first.
> Default choices from the factory doctrine need no entry; deviations always do.

## Format
```
### D<nn> — <title> (<YYYY-MM-DD>, <who decided: Bill | orchestrator | agent>)
Context: <what forced a choice>
Decision: <what we do>
Alternatives: <what we didn't do, one line each>
Consequences: <cost, follow-ups, how to revisit>
```

## Entries
### D21 — The design test also checks markers, retired names and contrast (2026-11-13, ux-architect, lane R0)
Context: Tailwind draws nothing for a class it does not know, so a leftover `bg-raised` or `type-hero` fails silently on screen; and "AA in both themes" was a claim in a comment, not a check.
Decision: `tests/design.test.ts` adds three checks to the factory's: (1) an `awaiting redesign lane R<n>` marker names the lane that owns the file, and no foundation file carries one; (2) a file without that marker uses no retired name (the list is in the test and in `factory/handoffs/redesign-r0.md`); (3) text, field edges, the focus ring and status pills meet WCAG AA, computed from the tokens in `globals.css`.
Alternatives: extend `scripts/design-check.ts` (it is copied from the factory as is, so it stays comparable); trust review.
Consequences: a lane cannot remove its marker and leave old names behind. When the redesign is done the retired list can stay as a guard or go.

### D20 — Gallery screens use the app's demo store, through its public API only (2026-11-13, ux-architect, lane R0)
Context: screens read `useShift()`; the store's context is private to `src/lib/store/react.tsx`, which nobody may edit (R-D1, R-D6), and the store is one per tab.
Decision: `GalleryStore` (`src/components/design/gallery-store.tsx`) asks for the in-memory demo store the same way `?demo=1` does, then brings it to a state with the store's own actions: `sample="empty"` calls `wipeDevice()`, `prepare` runs any other action (`clockIn`, `startBreak`…). Nothing is saved and nothing syncs. Links between gallery pages are full page loads; a page reached by a client-side link reloads itself once, so it never shows another page's store.
Alternatives: export the context or accept a store prop (needs an edit under `src/lib/store`); mock the store (screens would no longer be the real thing).
Consequences: the full state is always the generated ten weeks, dated from today, so images differ from day to day. A state the actions cannot reach needs a change to the store, asked for in a handoff.

### D19 — The place's name is in the top bar; the page column starts at the left edge (2026-11-13, ux-architect, lane R0)
Context: v1 showed a 32px page title in the content and repeated it small in the top bar; narrow pages were centred, so their left edge never lined up with anything.
Decision: the top bar names the place on every width (`text-title`); `PageHeader` keeps the page's `<h1>` for screen readers and shows only its description and actions. `Page` is not centred: `default` up to 1152px, `narrow` 672px, both starting at the page edge under the title.
Alternatives: title in the content and none in the bar (phones lose it when they scroll); centred columns (a floating island on wide windows).
Consequences: sub-pages (a settings page, Add session) show their own title in the content, as they do today.

### D18 — Five tabs in the phone bottom bar, no More sheet (2026-11-13, ux-architect, lane R0)
Context: the standard prefers four tabs and a More sheet [P]; SHIFTY has exactly five places and R-D1 keeps every route.
Decision: Home · Sessions · Insights · Companion · Settings stay as five tabs, 75px each at 375px, labelled, 56px tall.
Alternatives: four tabs + More holding one or two places (an extra tap, and a hidden place, to save 15px a tab).
Consequences: a sixth place would go behind More.

### D17 — One box, no box around a figure, no icon in an empty state (2026-11-13, ux-architect, lane R0)
Context: v1 had four card variants (one an inset well for boxes inside boxes), stat tiles each in their own box, and a tinted icon circle on empty states.
Decision: `Card` is one flat box (border, no shadow; `padding` and `interactive` only). `StatTile` has no surface: tiles sit in a grid inside one region. `EmptyState` is a sentence, an optional second line and the first action. Dialogs, sheets, sign-in and legal pages draw no inner boxes.
Alternatives: keep `raised`/`hero`/`ghost` as aliases (the sloppy screen stays writable).
Consequences: feature lanes regroup with space and dividers; the mechanical edits are listed in the R0 handoff.

### D16 — One focus ring, drawn once in globals.css (2026-11-13, ux-architect, lane R0)
Context: the starter draws focus per component as a 3px ring at 40% of a mid grey: under 3:1 against white. SHIFTY v1 had a `focus-ring` utility that each element had to remember.
Decision: `:focus-visible` gets a 2px outline in `--ring` with a 2px gap, on every focusable element; `--ring` is at least 3:1 on every surface in both themes (tested). Components draw nothing of their own; `focus-ring` is retired.
Alternatives: the starter's ring (fails 3:1); a coloured ring (R-D5: no hue in the interface).
Consequences: a custom control needs no focus styling. A field shows the ring while it is typed in.

### D15 — Goal progress is a bar; the ring is retired (2026-11-13, ux-architect, lane R0; R-D3)
Context: the standard has no rings or gauges (§13); the Home and session rings answer "how much of the goal is done", which a bar answers in a tenth of the space, and the largest number is now 28px, which a 232px ring would dwarf.
Decision: `ProgressBar` (`src/components/ui/progress-bar.tsx`): goal part and, past the goal, a lighter overage part on the same bar, greys only, with the figures in words beside it. `ProgressRing` stays in the folder, stripped of glow and tones, only until Home (R1) and session detail (R2) stop importing it; the design test fails any converted file that does.
Alternatives: keep a plain ring on Home (still a gauge); delete the ring now (needs a restyle of two feature screens, which is not R0's).
Consequences: delete `progress-ring.tsx` and its test once R1 and R2 have landed.

### D14 — Five status tones; a status does not pulse (2026-11-13, ux-architect, lane R0)
Context: v1 had seven tones, two of them decoration (`accent` in the brand colour, `celebrate` in orange), and a pulsing dot on live states.
Decision: `neutral` inactive · `info` in progress · `warning` waiting · `danger` problem · `success` done, each a light tint with dark ink of the same hue, a dot or icon and a word. Clocked in and Syncing are `info`; On break and Needs attention are `warning`; Completed and Synced are `success`. One pill size; no `live` animation.
Alternatives: keep a violet tone for "active" (the brand colour would tint the interface, against R-D5).
Consequences: rewards and achievements have no colour of their own outside Mochi's drawing; they are words, figures and the neutral pill.

### D13 — The accent setting no longer colours anything (2026-11-13, ux-architect, lane R0; needs Bill's nod)
Context: R-D5 gives the interface one action colour, near-black. Appearance → Accent (lilac, indigo, teal, peach) existed to tint buttons, rings and navigation. R-D1 says every feature stays.
Decision: the foundation follows R-D5: no token depends on the accent, and `<html data-accent>` is gone. The stored value, its setter and `AccentSetting` stay, so the saved setting is untouched and the Appearance screen keeps working. The screen plan for `/settings/appearance` takes the Accent row out (a control that changes nothing is a tell); the value stays in the saved settings.
Alternatives: keep tinting (against R-D5); repaint Mochi with it (Mochi has her own palettes, R-D4); leave a dead control.
Consequences: this is the one place where R-D5 overrides R-D1. If Bill wants the row kept, R5 leaves it in and it needs a job first.

### D12 — What the system leaves open, decided once (2026-11-13, ux-architect, lane R0)
Context: the standard does not fix every value; each was decided in `globals.css` or a primitive, not per screen.
Decision: (1) one typeface: Outfit is removed, Geist does everything; (2) corner sizes beyond sm/md/lg/xl are switched off (`--radius-*: initial`), like the type sizes and shadows; (3) button sizes are `xs`, `sm`, `default`, `lg`; `lg` (44px on phones) is for the one main action of a phone screen, and `xl` and the round clock button are retired; (4) a switch that is off is the `control` grey (3:1), on is `--primary`; (5) a segmented control marks the choice with a raised surface and darker text, never the action colour; (6) the Companion's navigation icon is a face, not sparkles; (7) the bottom bar and the sheets are flat: no blur, no float, no grab handle (nothing can be dragged); (8) the logo's colours are tokens (`logo-*`), used by `brand-mark.tsx` only; (9) `design:shots` starts the app with no Supabase settings, so the gallery never touches a database.
Alternatives: per-screen choices.
Consequences: a new need is added here first, then used.

### D11 — The factory's design system replaces the ink and cream look (2026-11-12, Bill; supersedes D06)
Context: SHIFTY v1 predates the enforced design standard and had the tells Bill rejects: a dark purple theme, a glow, boxes in boxes, capital-letter labels, faint text, a ring that answers nothing.
Decision: R-D1 to R-D6 in `factory/REDESIGN.md`: look only; light by default with dark as an option; no glow, no gradients; Mochi keeps her colours; the action colour is near-black; no database work. Lane R0 installed the system (`src/app/globals.css`, `scripts/design-check.ts`, `/design`).
Alternatives: restyle screen by screen without a system (how v1 got here).
Consequences: `PRODUCT.md` § Non-functional "Look" describes the old look until the release PR updates it.

### D10 — No audit_logs triggers on SHIFTY tables (2026-10-25, database-engineer)
Context: org admins can read `audit_logs`; shift data is private to its owner.
Decision: history lives in owner-only `shift_events` (append-only) and `session_revisions`; no generic audit trigger on tracking tables. Cross-session overlap is a domain rule (explicit override allowed), not a DB constraint.
Consequences: admins never see someone's shifts, even through the audit log.

### D09 — Supabase sync waits for SHIFTY's own project (2026-10-25, orchestrator)
Context: the only Supabase credentials in the build environment belong to pasuax-executive-matrix; the access token can't create projects.
Decision: never touch that project. Preview runs in device mode; sync switches on when SHIFTY's own project env vars are set (A01).
Alternatives: a schema inside the other project (mixes two products' data and auth users — refused).
Consequences: cross-device sync and the live RLS proof are blocked on Bill creating the project; local Postgres proves migrations + RLS meanwhile.

### D08 — Print stylesheet instead of @react-pdf (2026-10-25, orchestrator)
Context: one person prints/saves their own report; no forwarding workflow.
Decision: a printable report page with a print stylesheet (browser "Save as PDF").
Alternatives: @react-pdf/renderer (heavier bundle, fonts to embed).
Consequences: revisit if reports get emailed.

### D07 — Local notifications only; no server push in phase 1 (2026-10-25, orchestrator)
Context: Web Push needs VAPID keys, a cron and a subscription store; iOS only delivers to installed PWAs.
Decision: in-app rest prompts + `Notification` while the app is open/recent + Badging API where supported; labelled as not equivalent to iOS Live Activities.
Alternatives: Web Push now (credential + job work with little phase-1 value).
Consequences: reminders need the app opened; phase 4 adds Web Push.

### D06 — Bill's ink/cream look instead of doctrine §15 neutrals (2026-10-25, Bill via brief)
Context: consumer product; Bill's brief and reference images ask for deep ink dark, cream light, lilac accent, glowing ring, mascot.
Decision: follow the brief; keep doctrine restraint where it doesn't conflict (no rainbow, one glow, semantic colour, AA contrast).
Consequences: tokens live in `globals.css`; the design reference page is `/design`.

### D05 — Service worker precaches the app shell (2026-10-25, orchestrator)
Context: offline launch is a core requirement; pages hold no personal data (it lives in IndexedDB).
Decision: precache static shell routes + `/_next/static/**`; never API responses, never authenticated HTML, never other origins.
Consequences: shell updates need the versioned-cache flow in `public/sw.js`.

### D04 — Device mode: tracking pages are a public static shell (2026-10-25, orchestrator)
Context: one person, offline-first, preview must be usable before Supabase exists.
Decision: `/`, `/sessions/**`, `/insights`, `/companion`, `/settings/**` render signed out and read IndexedDB; `/api/sync/*` always requires a session + `shift:track`; RLS = own rows only.
Alternatives: redirect to /login (breaks offline and the credential-free preview).
Consequences: security review covers it; device data is cleared on sign-out after a warning.

### D03 — Event-sourced, local-first session model (2026-10-25, orchestrator)
Context: clock actions must survive offline, app kills and two devices without silent overwrites.
Decision: every change is an event with a device UUID; one pure reducer (`src/lib/shifts/reducer.ts`) folds events on the device and on the server; the server commits atomically through `commit_shift_event()` with revision checks; the DB enforces the invariants (one active session, break chronology, unique event ids).
Alternatives: CRUD rows with last-write-wins (loses data), PL/pgSQL state machine (duplicates the rules).
Consequences: rules change in one file; server cost per batch loads the user's sessions (fine for one person, revisit beyond ~10k sessions).

### D02 — Timezone engine on Intl, no date library (2026-10-25, orchestrator)
Context: day splits must be exact across DST and zones that skip or repeat midnight.
Decision: `src/lib/time/zone.ts` finds day boundaries by binary search on the zone's wall clock (whole seconds), cached; integer ms everywhere.
Alternatives: Temporal polyfill (~50 kB), date-fns-tz (naive 24h helpers invite mistakes).
Consequences: property tests across 11 zones guard it.

### D01 — Stack from the factory defaults (2026-10-25, orchestrator)
Context: new app bootstrapped from bill-app-factory `nextjs-supabase`.
Decision: Next.js 16 App Router + TypeScript, Supabase (Postgres, Auth, RLS, Storage), Vercel, Tailwind v4 + Radix primitives, Zod, Vitest, Playwright.
Alternatives: see THE_WAY_BILL_MAKES_APPS.md § Default stack.
Consequences: deviations get their own entry.
