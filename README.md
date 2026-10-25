# SHIFTY

A personal, session-first work tracker: clock in, track shifts across midnight, see beautiful reports, and grow a cozy companion.

Built from the Bill App Factory `nextjs-supabase` template.
Real auth, org-scoped data with RLS, an app shell that works on phones, PWA basics, tests and gates.

## Setup

```bash
npm ci
cp .env.example .env.local      # fill in; every variable is tagged [public]/[server]/[secret]/[scripts]
npm run db:migrate              # applies supabase/migrations over HTTPS (Management API)
ADMIN_EMAIL=you@company.com ORG_NAME="Company" npm run db:configure
npm run dev                     # http://localhost:3000 → /login
```
Create the admin user in Supabase → Authentication → Users (auto-confirm). Their first sign-in claims Admin.

## Checks

| Command | What |
| --- | --- |
| `npm run check` | lint + typecheck + unit tests (the Claude Code Stop hook runs this) |
| `npm run check:full` | + production build |
| `npm run test:e2e` | Playwright smoke against `E2E_BASE_URL` (desktop, 375px, 430px) |
| `npm run db:local-check` | migrations + RLS check on a throwaway local Postgres (Supabase stub) |
| `npm run db:check-rls` | live proof that another organization sees and changes nothing |
| `npm run db:migrate -- --status` | applied / pending migrations |

## Layout

| Path | Purpose |
| --- | --- |
| `src/proxy.ts`, `src/lib/public-paths.ts` | Session refresh, signed-out pages → `/login?next=` |
| `src/lib/current-user.ts` | `requireSession()` for pages, `apiSession()` for routes |
| `src/lib/permissions.ts` | Role → capability map; mirrored by `has_capability()` in SQL |
| `src/lib/validation.ts` | Zod schemas for every request body |
| `src/lib/data/` | Repositories (Supabase under RLS; in-memory for tests) |
| `src/lib/supabase/` | Server, browser and service-role clients |
| `src/app/api/` | Route handlers: `{ data }` or `{ error }`, status codes 400/401/403/404/409 |
| `src/app/(app)/` | Signed-in shell: sidebar, top bar, phone bottom bar |
| `src/app/(auth)/`, `src/app/(legal)/` | Sign-in, sign-up, reset, `/onboarding` (SaaS); privacy, terms, cookies, data deletion (public) |
| `src/lib/legal.ts` | Who runs the app, contact, jurisdiction, processors, retention: every legal page reads it; `npm run legal:check` before launch |
| `src/app/(app)/settings/account` | Your data: download (`/api/account/export`) and delete account (`delete_own_account()`) |
| `src/lib/money.ts` | Money in integer minor units: `formatMinor`, `toMinor`, `fromMinor` |
| `src/components/ui/` | Button, dialogs, sheet, confirm, status pill, skeleton, empty state |
| `supabase/migrations/` | Schema, RLS, audit triggers. Numbered ranges per owner; never edit applied files |
| `public/sw.js` | Offline page + push only; caches no app data |
| `scripts/` | migrate, sql, check-rls, configure, icons, stop-gate |

## Adding an entity (copy the `projects` pattern)
Bootstrapped with `--no-example`? The pattern still lives in the factory's `templates/nextjs-supabase`
(`supabase/migrations/0010_projects.sql`, `src/lib/data/projects.ts`, `src/app/api/projects/`, `src/components/projects/`).

1. Migration in your range: table with `organization_id` FK, timestamps, CHECKs, list indexes, RLS via `has_capability()`, audit trigger.
2. Capabilities in `permissions.ts` **and** `private.role_capabilities()` (new migration replacing the function).
3. Zod schemas → repository → routes → UI (table desktop / cards phone, drawer, confirm on delete).
4. Tests: validation, route permissions with the in-memory repository; extend `scripts/check-rls.ts`.

## Deploy

Vercel project from this repo; env vars per environment (see `.env.example`); `npm run db:migrate` against the
target project before promoting; then the factory's `scripts/verify-production <url>`.
Scheduled jobs: `supabase/optional/cron.sql.example` (pg_cron + Vault, not Vercel Cron).
