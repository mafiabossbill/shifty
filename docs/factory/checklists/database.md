# Database checklist

For every migration. Standards: [../docs/DATABASE_STANDARD.md](../docs/DATABASE_STANDARD.md), [../docs/SUPABASE_STANDARD.md](../docs/SUPABASE_STANDARD.md). Workflow: [../workflows/database-change.md](../workflows/database-change.md).

## File
- [ ] New file `supabase/migrations/NNNN_name.sql` inside your assigned range ([../factory/OWNERSHIP.md](../factory/OWNERSHIP.md))
- [ ] No edit to a migration that has shipped (add a new one)
- [ ] `npm test` passes `tests/migrations.test.ts` (unique versions, RLS on every table, org FK + timestamps)

## Tables
- [ ] `id uuid primary key default gen_random_uuid()`
- [ ] Tenant tables: `organization_id uuid not null references organizations (id) on delete cascade`
- [ ] Child rows that must stay in the same org use composite FKs `(organization_id, parent_id)`
- [ ] `created_at` / `updated_at timestamptz not null default now()` + `set_updated_at` trigger
- [ ] CHECK constraints for invariants (non-blank text, ranges, "status X requires field Y")
- [ ] Enums for closed sets; snake_case plural table names
- [ ] Indexes for each list query (`(organization_id, sort_col)`), each FK used in joins, partial indexes for "open" subsets

## Security
- [ ] `alter table … enable row level security` in the same migration
- [ ] Read policy `organization_id in (select my_organization_ids())`
- [ ] Write policies use `has_capability(organization_id, '<cap>')` (plus ownership where needed)
- [ ] New capability added to BOTH `src/lib/permissions.ts` and `private.role_capabilities()` (`tests/permissions.test.ts` passes)
- [ ] `security definer` functions set `search_path`, revoke from `public, anon`, grant only what's needed
- [ ] `scripts/check-rls.ts` extended: outsider sees/changes nothing; each role does exactly what the map says

## History
- [ ] Business tables get the audit trigger (`private.audit_row_change()`)
- [ ] Soft-delete policy followed: deactivate people, archive referenced records, hard-delete leaf content

## Safety
- [ ] Destructive change split across releases (add + backfill + switch; remove later)
- [ ] Large backfills batched; no long table locks during business hours
- [ ] `npm run db:local-check` PASS (migrations + RLS on local Postgres)
- [ ] Applied to dev with `npm run db:migrate`; `npm run db:check-rls` PASS on dev
- [ ] Production only via `scripts/release migrate` by the release owner
