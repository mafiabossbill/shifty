# Testing standard

How every factory app proves it works. Doctrine: [THE_WAY_BILL_MAKES_APPS.md](../THE_WAY_BILL_MAKES_APPS.md) §21.
Tags: **[U]** universal · **[P]** preferred default · **[S]** product-specific.

## 1. The pyramid

| Layer | Proves | Tool | Where | Runs |
| --- | --- | --- | --- | --- |
| Unit [U] | Business rules, parsers, schedules, formatting give the right answer | Vitest 5 (node env) | `tests/*.test.ts` | Every commit (Stop hook), CI |
| Route [U] | Each handler enforces session → validation → permission → repository, with the right status codes | Vitest + `vi.mock("@/lib/current-user")` + in-memory repository | `tests/<entity>-route.test.ts` | Every commit, CI |
| Static [U] | Capability map ↔ SQL mirror, env vars documented and classified, migrations unique with RLS, PWA files sane | Vitest reading files | `tests/permissions.test.ts`, `config.test.ts`, `migrations.test.ts`, `pwa.test.ts` | Every commit, CI |
| DB local [U] | Every migration applies on real Postgres; RLS isolates orgs and enforces roles | `npm run db:local-check` (Postgres 16 + Supabase stub) | `scripts/db-local-check.sh`, `scripts/check-rls.ts` | Every PR (CI `database` job), release preflight |
| DB live [U] | The same RLS rules on the real Supabase project | `npm run db:check-rls` | `scripts/check-rls.ts` | After policy changes, every production migration |
| E2E smoke [U] | Health, sign-in redirect, public legal pages, manifest, SW headers, no sideways scroll, 16px inputs | Playwright: desktop, 375, 430 | `e2e/smoke.spec.ts` | Every preview + production (`deployment_status`) |
| E2E journeys [P] | The core loop signed in (create → edit → delete; role differences) | Playwright with `E2E_EMAIL`/`E2E_PASSWORD` | `e2e/<journey>.spec.ts` (skip without credentials) | Before release |
| Visual sweep [P] | Overflow, touch targets <44px, inputs <16px, layout shift at every width and theme | Playwright script | `scripts/ui-sweep.mjs` pattern (below) | UI waves, redesigns |
| Production [U] | The deployment answers correctly from outside | `scripts/verify-production` | [../scripts/verify-production](../scripts/verify-production) | After every production deploy |

## 2. Unit tests [U]
- Business rules are pure functions that take `now`/`today` as parameters: deterministic tests, no clock mocking (e.g. `applyProgressUpdate(task, input, now)`).
- Test the rule AND its boundary message: the user-facing sentence is part of the contract (`NOTE_REQUIRED_MESSAGE`).
- One test file per rule module; name tests as behaviour ("requires a blocker to move to Blocked").
- `server-only` is aliased to a stub in `vitest.config.mts`, so server modules import directly.
- No network, no Supabase, no timers in unit tests.

## 3. Route tests with an in-memory repository [U]
Pattern: [../templates/nextjs-supabase/tests/projects-route.test.ts](../templates/nextjs-supabase/tests/projects-route.test.ts).
```ts
const sessionMock = vi.hoisted(() => ({ current: null }));
vi.mock("@/lib/current-user", () => ({ apiSession: async () => sessionMock.current }));
const { GET, POST } = await import("@/app/api/projects/route");
```
- The real handler runs; only the session (Supabase auth + RLS client) is replaced by a session holding `InMemoryProjectRepository`.
- Cover for every route: 401 signed out · 400 with the exact first validation sentence · 403 per role that must be refused · 404 missing · happy path status (201/200) and body shape `{ data }`.
- Route tests prove the **server** layer; RLS is proven separately (§5). Both are required.

## 4. Static tests [U]
| Test | Fails when |
| --- | --- |
| `tests/permissions.test.ts` | `ROLE_CAPABILITIES` and `private.role_capabilities()` in SQL differ, or an unknown capability is granted |
| `tests/config.test.ts` | Code reads an env var missing from `.env.example`, a variable lacks a class tag, or a `NEXT_PUBLIC_` var is tagged `[secret]` |
| `tests/migrations.test.ts` | Two migrations share a version, a created table lacks `enable row level security`, an org-scoped table lacks the FK/timestamps |
| `tests/pwa.test.ts` | Manifest has absolute URLs, icons are not RGBA of the declared size, the service worker caches more than the offline page |

## 5. Database checks
| Check | Command | What it is | Limits |
| --- | --- | --- | --- |
| Local [U] | `npm run db:local-check` | Throwaway Postgres 16 (`initdb`), `supabase/local/supabase-stub.sql` (auth.users, `auth.uid()`, API roles, default grants), all migrations, then the RLS check block | Not Supabase: no Storage, Realtime, Vault, pg_cron, real Auth. Prints SKIP when Postgres binaries are missing (set `PG_BIN`) |
| Live [U] | `npm run db:check-rls` | Same DO block over the Management API against the real project; impersonates users with `set local role authenticated` + `request.jwt.claims`; raises its results so everything rolls back | Needs `SUPABASE_ACCESS_TOKEN`; run against dev first, production only through `scripts/release migrate` |
- [U] Extend `scripts/check-rls.ts` with every new table: outsider sees and changes nothing; each role can do exactly what `permissions.ts` says; a control row proves the admin path works (so zeros aren't passing because nothing works).
- [P] A mature app's check grows past 100 expectations (`scripts/check-rls.ts`), including deactivated members, cost redaction and admin-created people.

## 6. E2E
- [U] Smoke suite needs no account and runs anywhere: `E2E_BASE_URL=https://<deployment> npm run test:e2e`.
- [U] Projects: `desktop` 1280×800, `phone-375`, `phone-430` (touch + mobile) in `playwright.config.ts`.
- [U] Cloud sessions: never run `playwright install`; use the preinstalled browser: `E2E_CHROMIUM_PATH=/opt/pw-browsers/chromium`.
- [U] `scripts/check --e2e <url>` runs the suite as a gate step.
- [P] Signed-in journeys skip themselves unless `E2E_EMAIL`/`E2E_PASSWORD` are set; test accounts use the reserved `example.test` domain and are removed at go-live.
- [P] Never mutate shared data in e2e against production; journeys run on preview with a dev Supabase project.

## 7. Visual and mobile sweep [P]
`scripts/ui-sweep.mjs`: signs in as admin and member, opens every page and main overlay at 360/390/768/1280 in light or dark, saves screenshots and `metrics.json` (horizontal overflow, targets <44px, inputs <16px, layout shift). Use it for UI waves and redesigns; review the screenshots, not just the metrics.

## 8. QA independence and honest reporting [U]
- The builder's "works on my machine" is not evidence. QA is a different agent/session than the builder ([AGENT_SYSTEM.md](AGENT_SYSTEM.md)).
- Report exactly what ran: command, counts, pass/fail. Anything not run is written as `not run: <reason>` (e.g. `not run: no SUPABASE_ACCESS_TOKEN in this environment`).
- "Flaky" is not a root cause. Re-run once only to confirm an infrastructure failure; a second failure is real.
- Never skip, disable or delete a test to get green.
- Paste failing output into the handoff ([../factory/HANDOFFS.md](../factory/HANDOFFS.md)) when a test can't be fixed in scope.

## 9. Commands
| Command | Runs |
| --- | --- |
| `npm run check` | lint + typecheck + unit/route/static tests (Stop hook) |
| `npm run check:full` | + `next build` |
| [../scripts/check](../scripts/check) `--dir APP --build --db --e2e URL` | Every gate with PASS/FAIL per step |
| `npm run db:local-check` | Migrations + RLS on local Postgres |
| `npm run db:check-rls` | Live RLS proof |
| `npm run test:e2e` | Playwright against `E2E_BASE_URL` |
