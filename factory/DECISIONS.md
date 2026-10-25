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
