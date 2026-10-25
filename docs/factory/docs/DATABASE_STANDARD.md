# Database standard

Detail behind [THE_WAY_BILL_MAKES_APPS.md](../THE_WAY_BILL_MAKES_APPS.md) §7, §11, §31. Reference: `templates/nextjs-supabase/supabase/migrations/0001_foundation.sql`, `0010_projects.sql`.
Tags: **[U]** universal · **[P]** preferred default · **[S]** product-specific.

## 1. Principles [U]
- The database enforces the rules that must never break; the app explains them. Both, never just the UI.
- Every change is a migration file. **Never** edit a production database by hand; never edit an applied migration.
- RLS on every table, in the same migration that creates it (`tests/migrations.test.ts` fails otherwise).

## 2. Naming [P]
| Thing | Convention | Example |
| --- | --- | --- |
| Tables | snake_case, plural | `projects`, `organization_members` |
| Columns | snake_case; FKs `<thing>_id`; booleans `is_`/`has_` or past participle | `owner_id`, `approval_required` |
| Timestamps | `<event>_at timestamptz` | `created_at`, `deactivated_at`, `completed_at` |
| Dates (no time) | `date`, named for meaning | `due_date`, `incurred_on` |
| Indexes | `<table>_<cols>_idx` | `projects_org_status_idx` |
| Policies | `<table>_<action>` | `projects_update` |
| Functions | verb phrases | `record_progress_update`, `claim_admin_bootstrap` |
| Enums | singular noun | `member_role`, `project_status` |
| Private helpers | schema `private` (not exposed by the API) | `private.app_settings`, `private.audit_row_change()` |

## 3. Keys and relationships [U]
- Primary keys `uuid default gen_random_uuid()`; `bigint generated always as identity` for high-volume logs (`audit_logs`).
- Every tenant table: `organization_id uuid not null references organizations (id) on delete cascade`.
- [U] Children of tenant rows use **composite FKs** so a row can't point across tenants:
  ```sql
  unique (organization_id, id)                                          -- on the parent
  foreign key (organization_id, task_id) references tasks (organization_id, id) on delete cascade -- on the child
  ```
  (e.g. tasks ↔ departments, progress_updates, comments, attachments.)
- `on delete`: `cascade` for owned children, `set null` for people references (history keeps the row), `restrict` when deletion must be decided.
- Human-readable codes (e.g. `PAR-0001`) [S] come from a row-locked per-org counter in a trigger, never `max()+1`.

## 4. Columns and constraints [U]
- `created_at timestamptz not null default now()`, `updated_at` + `set_updated_at()` trigger on every mutable table.
- `text` + CHECK for lengths (`length(trim(name)) between 1 and 120`), not `varchar(n)`.
- Enums for closed sets that rarely change; a lookup table when admins edit the list.
- CHECKs encode invariants: `status <> 'Blocked' or blocker is not null`; `deadline >= start_date`; `progress between 0 and 100`; E.164 phone format.
- Money: integer minor units (`amount_minor bigint`) + `currency char(3)`; never floats; never convert stored amounts. `src/lib/money.ts` formats (`formatMinor`) and parses typed input (`toMinor`).
- Personal data: every reference to `profiles` is `on delete set null`, so account deletion anonymizes history instead of failing or cascading it away (`0004_account.sql`).
- `jsonb` only for genuinely schemaless payloads (audit diffs, provider events, view configs).

## 5. Indexes [U]
| Query shape | Index |
| --- | --- |
| List by org, newest first | `(organization_id, created_at desc)` |
| Filter by status/owner within org | `(organization_id, status)`, `(owner_id)` |
| "Open" subsets | Partial: `where status not in ('done','cancelled')` |
| Keyset paging by a sort column | `(organization_id, <col>, <tiebreaker>)` |
| Full-text / fuzzy search | Stored `tsvector` + GIN; `pg_trgm` GIN for codes/names |
| FK used in joins/deletes | Index the FK column |
| Exactly once per period | **Partial unique index** (e.g. `generated_reports_scheduled_once`) |

## 6. Delete policy [P]
| Data | Policy | Why |
| --- | --- | --- |
| People / members | **Deactivate** (`deactivated_at`); helpers ignore deactivated rows | History keeps its authors |
| Referenced entities (departments, customers, assets) | **Archive** (`archived_at`); hidden from pickers | Old records still resolve |
| Leaf content (drafts, comments, attachments) | Hard delete, or `deleted_at` when "deleted by" must show | Simplicity |
| Append-only history | Never updated or deleted (trigger forbids UPDATE; no delete policy) | Accountability (e.g. `progress_updates`) |
| Everything | Audit row on delete | Recoverability and blame-free review |

## 7. Audit, transactions, idempotency
- [P] **Audit**: attach `private.audit_row_change()` (generic, changed columns only, actor `auth.uid()`) to every business table:
  ```sql
  create trigger projects_audit after insert or update or delete on projects
    for each row execute function private.audit_row_change();
  ```
  Read access via `has_capability(org, 'audit:view')`. Redact sensitive columns per capability in a reader function (e.g. an activity reader that hides costs).
- [U] **Transactions as functions**: a rule touching several rows (state + history, create person + membership + audit) is one Postgres function. `security invoker` when the caller's RLS should apply; `security definer` + `set search_path` + explicit checks when it must cross RLS (bootstrap, invite claim).
- [U] **Guard triggers** for fields only one function may change (with a transaction-local flag).
- [U] **Idempotency ledgers**: unique key per external event or per (entity, kind, period) — claim the row first, then act (e.g. `webhook_events`, `task_alerts`, `whatsapp_digests`).

## 8. RLS patterns [U]
| Operation | Pattern |
| --- | --- |
| Select | `organization_id in (select my_organization_ids())` (initplan: once per query) |
| Insert | `has_capability(organization_id, 'x:create') and created_by = auth.uid()` |
| Update | `using` and `with check` both: capability, or own-row capability + `owner_id = auth.uid()` |
| Delete | `has_capability(organization_id, 'x:delete')` |
| Own rows only | `profile_id = auth.uid()` (preferences, subscriptions) |
| Service-only tables | RLS on, **no policies** (only the service role reads/writes) |
| Views | `security_invoker = true` so RLS still applies |
Details and helpers: [SUPABASE_STANDARD.md](SUPABASE_STANDARD.md).

## 9. Migrations [U]
- File name `NNNN_snake_name.sql`, four digits. Runner: `scripts/migrate.ts` (Management API, one transaction per file + its `schema_migrations` row).
- **Ranges per owner** in `factory/OWNERSHIP.md` ([../factory/OWNERSHIP.md](../factory/OWNERSHIP.md)): template 0001–0019, then decades per agent/session (0020s, 0030s…). Every writer of migrations gets a range.
- **The 0080 lesson**: two parallel sessions both wrote `0080_*.sql`; the old runner skipped "already applied" versions, so one migration would have silently never run. The factory runner **refuses duplicate versions** and refuses DB versions with no local file (`scripts/migrations.ts`, `tests/migrations.test.ts`).
- Append-only: fix a shipped migration with a new one. `scripts/release` blocks edited migrations.
- **Destructive changes in two releases**: (1) add new column/table, backfill, switch reads/writes; (2) after verification, drop the old one. Never rename-in-place a column the running app reads.
- Each migration: idempotent where cheap (`if not exists`, `create or replace`), RLS + policies + indexes + audit trigger for new tables, comment header saying what and why.
- Verify before any real project: `npm run db:local-check` (local Postgres + Supabase stub + RLS check), then `npm run db:check-rls` live.

## 10. Seeds and demo data [U]
- Seeds are scripts, idempotent (stable ids, insert-if-missing), clearly fake (reserved domains `example.test` / `.invalid`, banned users).
- Demo data lives only in development/preview projects, or in a throwaway org for perf tests that deletes itself.
- **Go-live cleanup** is a checklist item: delete demo rows and test accounts in production (or never create them there); confirm with a count query recorded in `factory/STATE.md`.

## 11. Performance [P]
- Measure at realistic scale before launch (thousands of rows) with the real user's RLS.
- Avoid per-row `security definer` calls in read policies on big tables (measured: ~370 ms → negligible).
- Keyset pagination over offset; virtualize long lists in the UI.

## 11b. Added after the simulations
| Topic | Rule | Tag |
| --- | --- | --- |
| Money from providers | Store **integer minor units** (`bigint`, e.g. Stripe `amount`) + `currency char(3)`; format with `formatMinor()`. User-entered amounts go through `toMinor()` into the same shape. Never mix units in one column. Blueprint field type `money_minor` | [U] |
| Signed records | A signature (image + signer + time + `payload_sha256` of what was signed) makes the record immutable: a trigger refuses updates to signed fields; corrections are new records that reference the old one | [U] |
| Plan / billing gating | Reads stay open; writes add `and workspace_active(organization_id)` to the policy (see `templates/nextjs-supabase/supabase/optional/saas-tenancy.sql.example`) and the server checks the plan before writing | [P] |
| Role names | Before the first migrate you may rename the template's `member_role` values; after that keep the keys and relabel through `ROLE_LABELS` (renaming enum values in a live database is a two-step migration) | [P] |
| Replaying creates | `client_id uuid` + unique `(organization_id, client_id) where client_id is not null` on every table written by a retryable create | [U] |
| Code ↔ schema | `tests/schema-references.test.ts` fails when code reads a table or calls a function that no migration creates | [U] |
| Example entity | Remove it with `scripts/bootstrap --no-example` **before** the first migrate; once applied anywhere, drop it with a new migration instead (the runner refuses unknown applied versions) | [U] |

## 12. Database review checklist
- [ ] Migration in the owner's range, unique version, header comment
- [ ] `organization_id` FK, timestamps, CHECKs, enums/lookup decided
- [ ] Indexes for every list query and FK
- [ ] RLS enabled + policies for each operation; capability names match `permissions.ts`
- [ ] Audit trigger attached; sensitive columns redacted in readers
- [ ] Multi-row rules in one function; guard triggers for locked fields
- [ ] Idempotency key for anything triggered by jobs or webhooks
- [ ] Destructive change split across two releases
- [ ] `npm run db:local-check` green; `scripts/check-rls.ts` extended for the new table

Related: [../checklists/database.md](../checklists/database.md) · [../workflows/database-change.md](../workflows/database-change.md)
