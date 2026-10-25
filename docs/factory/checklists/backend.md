# Backend checklist

For every route handler, server function, job or webhook. Standards: [../docs/ARCHITECTURE_STANDARD.md](../docs/ARCHITECTURE_STANDARD.md), [../docs/SECURITY_STANDARD.md](../docs/SECURITY_STANDARD.md).

## Route handlers
- [ ] Pipeline in order: `apiSession()` → Zod `safeParse` → `can()` / ownership check → repository → response
- [ ] Success `{ data }` (lists may add `total`, `next_cursor`); errors `{ error: "Human sentence." }` via `jsonError`
- [ ] Status codes: 400 validation · 401 signed out · 403 not allowed · 404 missing/not visible · 409 rule/conflict · 503 not configured
- [ ] PATCH schemas `.strict()`; locked fields refused explicitly
- [ ] Sensitive fields redacted by capability before returning (e.g. costs)
- [ ] Route test covers 401, 400 (exact message), 403 per refused role, 404, happy path (`tests/*-route.test.ts`)

## Business logic
- [ ] Rules are pure functions in `src/lib/<domain>/` taking `now`/`today`; unit-tested
- [ ] Multi-row rules run in one Postgres function (one transaction), not several API calls
- [ ] The same rule is enforced in the database (constraint, trigger or function), not only in TypeScript
- [ ] Side effects (notifications, emails) run in `after()` and never fail the request

## Data access
- [ ] Only through a repository in `src/lib/data/` running as the signed-in user (RLS applies)
- [ ] Service-role client (`src/lib/supabase/service.ts`) used only in cron, webhooks or auth-admin code; every query filtered by `organization_id`
- [ ] No N+1 loops over the network; list queries use indexes (check `explain` for big tables)

## Jobs and webhooks
- [ ] Cron routes: `authorizedCron()` (Bearer `CRON_SECRET`, constant time); 503 when unset
- [ ] Work claimed in a ledger / unique index before acting (safe to run twice)
- [ ] Webhooks: signature verified on the raw body before parsing; provider event id recorded (duplicate → no-op)
- [ ] Structured logs `logEvent(level, event, { ids, counts })`; no tokens, emails, phones or bodies

## Config
- [ ] Every env var read is in `.env.example` with a class tag (`tests/config.test.ts` passes)
- [ ] Missing optional config turns the feature off and says so; it never crashes the app

## Verify
- [ ] `npm run check` green; `scripts/check --dir . --build` green before PR
