---
name: database-change
description: Make a schema or permission change safely — next migration number inside your range, RLS through has_capability(), capability map in both layers, extended RLS proof, local Postgres check. Use for any table, column, index, policy or capability change.
argument-hint: "<change>"
---

> Paths: in an app repo the factory docs are under `docs/factory/` (copied by bootstrap) and the scripts under `scripts/factory/`; in the factory repo they are at the root.

Change: $ARGUMENTS

1. Find your migration range in `factory/OWNERSHIP.md`; take the next free number in it. Never edit a migration that shipped.
2. Write `supabase/migrations/NNNN_name.sql`: `organization_id` FK (composite for children), timestamps + `set_updated_at`, CHECKs, indexes for list queries, `enable row level security`, policies via `has_capability()` and `my_organization_ids()`, audit trigger `private.audit_row_change()`.
3. Capabilities changed → `src/lib/permissions.ts` and a migration that replaces `private.role_capabilities()`; `npm test` (mirror test).
4. Extend `scripts/check-rls.ts` (outsider sees nothing; each role exactly what the map says).
5. `npm run db:local-check` (migrations + RLS on a throwaway local Postgres). Then dev project: `npm run db:migrate` and `npm run db:check-rls` if `SUPABASE_ACCESS_TOKEN` is available; otherwise say "not run: no access token".
6. Destructive (drop/rename/type change)? Two releases: add + backfill + dual-write, then switch + drop.
7. Production is the release-engineer's job (`release migrate` with the project ref typed twice). Handoff lists tables, policies, functions, RLS expectations.
