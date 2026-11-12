# Working on this app

@AGENTS.md

Built from the Bill App Factory `nextjs-supabase` template. Doctrine, standards, workflows and checklists:
`docs/factory/` (copied by bootstrap; start with `docs/factory/THE_WAY_BILL_MAKES_APPS.md`). Release scripts: `scripts/factory/`.
Product truth: `PRODUCT.md`. Shared build state: `factory/` (STATE, TASK_GRAPH, OWNERSHIP, DECISIONS, HANDOFFS, MANUAL_CHECKS, RELEASES).

## Rules
- Read the Next.js guide in `node_modules/next/dist/docs/` before writing framework code (Next 16: `proxy.ts`, Cache Components, error boundaries take `retry`).
- Authorization: `src/lib/permissions.ts` server-side AND RLS (`has_capability()` in migrations). Change both together; `tests/permissions.test.ts` enforces it.
- Request order in every route: `apiSession()` → Zod parse → `can()` → repository (RLS) → `{ data }` or `{ error: "Human sentence." }`.
- Creates that may be retried (flaky network, offline queue) accept a client `client_id`; a repeat returns the original (see `POST /api/projects`).
- Data access only through repositories in `src/lib/data/`. No Supabase calls from components except storage/realtime via `getBrowserClient()`.
- Service-role client (`src/lib/supabase/service.ts`) only for cron, webhooks and auth-admin calls; scope every query by organization.
- Schema changes only as new files in `supabase/migrations/` inside your assigned number range. Never edit an applied migration. Never change the production DB by hand.
- Every new env var goes in `.env.example` with a class tag; `tests/config.test.ts` enforces it.
- Money: integer minor units + currency; format and parse only with `src/lib/money.ts`.
- Personal data: new fields go in the privacy policy, new entities in the export (`src/lib/data/account.ts`), new providers in `LEGAL.processors` (`src/lib/legal.ts`). References to `profiles` are `on delete set null`.
- UI: the standard is `docs/factory/docs/UI_UX_STANDARD.md`; the system is visible at `/design` in development. A screen is planned (purpose, one primary action, ranked content, states) before it is built.
- UI values come only from the system: seven type sizes (`text-caption` … `text-display`), two weights, the spacing scale, three shadows (`shadow-raised`, `-overlay`, `-modal`), token colours. `npm run design:check` runs inside `npm test` and fails anything else; a real exception is `// design-ok: <reason>`.
- Every signed-in screen has a gallery page per state with sample data (`src/app/design/screens/`, `src/lib/design-gallery.ts`; `tests/design.test.ts` enforces it). Before calling a screen done: `npm run design:shots`, open the images, review against `docs/factory/checklists/design-review.md`.
- UI patterns: shared primitives in `src/components/ui/` (`Field` for every form field), buttons by rank, destructive actions through `useConfirm()`, tables on desktop and cards on phones, 44px touch targets.
- Multi-lane work (the first build, a release-sized change) is orchestrated: `/orchestrate` in a Local session of the Claude desktop app in this folder starts one cloud session per lane. A lane session builds its own lane only and starts no sessions.
- Done = `npm run check:full` green + handoff written (`factory/HANDOFFS.md`). The Stop hook blocks finishing while `npm run check` fails.

## Commands
`npm run dev` · `npm run check` (lint+typecheck+test) · `npm run check:full` (+build) · `npm run design:check` · `npm run design:shots` · `npm run test:e2e` (needs E2E_BASE_URL) ·
`npm run db:migrate [-- --status]` · `npm run db:local-check` (local Postgres + RLS) · `npm run db:check-rls` (live) · `npm run db:configure` · `npm run pwa:icons '#hex'`
