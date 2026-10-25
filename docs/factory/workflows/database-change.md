# Workflow: database change

Owner: database-engineer. Skill: `/database-change <change>`. Standard: [../docs/DATABASE_STANDARD.md](../docs/DATABASE_STANDARD.md).

| # | Step | Command | Gate |
| --- | --- | --- | --- |
| 1 | Pick the next number **inside your range** (`factory/OWNERSHIP.md`) | `ls supabase/migrations` | No duplicate (the runner and tests refuse one) |
| 2 | Write the migration: table shape, FKs, timestamps, CHECKs, indexes, RLS on, policies via `has_capability()`, audit trigger | `supabase/migrations/NNNN_name.sql` | Never edit a shipped file |
| 3 | Capabilities changed? Update `permissions.ts` **and** replace `private.role_capabilities()` | — | `npm test` (mirror test) PASS |
| 4 | Extend the RLS proof | `scripts/check-rls.ts` expectations for outsider, each role | — |
| 5 | Prove locally | `npm run db:local-check` | PASS |
| 6 | Apply to dev project | `npm run db:migrate` (dev env) then `npm run db:check-rls` | PASS, or "not run: no access token" stated |
| 7 | Destructive? Split | release A: add + backfill + dual-write; release B: switch + drop | Reviewed in preflight (`--migrations-reviewed`) |
| 8 | Production | release-engineer only: `scripts/release migrate --project-ref REF --confirm-production REF` | Live check-rls PASS |
