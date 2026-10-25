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
- UI: tokens in `globals.css`, shared primitives in `src/components/ui/`, destructive actions through `useConfirm()`, tables on desktop and cards on phones, 44px touch targets, 16px inputs on phones.
- Done = `npm run check:full` green + handoff written (`factory/HANDOFFS.md`). The Stop hook blocks finishing while `npm run check` fails.

## Commands
`npm run dev` · `npm run check` (lint+typecheck+test) · `npm run check:full` (+build) · `npm run test:e2e` (needs E2E_BASE_URL) ·
`npm run db:migrate [-- --status]` · `npm run db:local-check` (local Postgres + RLS) · `npm run db:check-rls` (live) · `npm run db:configure` · `npm run pwa:icons '#hex'`
