### 2026-10-25 database-engineer — SHIFTY data model, RLS, commit RPC

AGENT: database-engineer
TASK: db — SHIFTY schema (sessions, breaks, locations, revisions, events, profile tables), RLS, commit/load RPCs, proofs
FILES CHANGED: supabase/migrations/0100_shift_capabilities.sql, 0101_shift_profile.sql, 0102_shift_sessions.sql, 0103_shift_functions.sql, 0104_shift_account.sql; supabase/local/shift-fixture.ts (new); scripts/check-rls.ts; src/lib/permissions.ts; tests/permissions.test.ts; tests/migrations.test.ts; docs/SCHEMA.md (new); factory/handoffs/db.md (new)

WHAT WAS IMPLEMENTED:
- People see only their own tracking data. Admins can't see other people's sessions either. Every policy on all 12 SHIFTY tables is `user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track')`. `shift:track` is granted to admin and member (TS and SQL map, tested).
- The database enforces the rules: one running session per person (`shift_sessions_one_active_idx`); end after start; goal 60–172800 s; breaks never overlap (deferrable gist exclusion); breaks lie inside their session, with at most one open break and only while the session is open (deferrable constraint triggers); captured ⇔ coordinates; composite FKs, so rows can't cross people or orgs.
- `commit_shift_event` stores the event idempotently, then the reducer's session (insert / revision-guarded update / purge) and syncs breaks, locations and revisions, all in one transaction. Deferred checks run at its end. `load_shift_state` returns ShiftState JSON that deep-equals the reducer's output (proved).
- Privacy centre: `delete_location_fixes` deletes the fixes and bumps the session revision. Coordinates are also redacted from the append-only event log on fix deletion and on purge (`redact_location_events`).
- Account: deletion cascades through `profiles` (proved: 0 rows left). `export_my_shift_data()` and `load_profile_state()` are ready for the export route.

IMPORTANT DECISIONS:
- Coordinator update applied: tables are named `reward_ledger_entries` and `companion_states`; there is NO cross-session overlap constraint (the reducer's `allowOverlap` decides).
- No `audit_logs` triggers on SHIFTY tables: `audit_logs` is readable with `audit:view` (admins), which would leak private tracking. History lives in `session_revisions` + `shift_events`, readable by the owner only.
- Session instants are `timestamptz`, converted by `ms_to_timestamptz` / `timestamptz_to_ms` (exact; proved over 203k values). That includes `client_created_at` / `client_updated_at` (the domain's createdAt/updatedAt), kept separate from the row's `created_at` / `updated_at`. Profile version stamps stay `bigint` ms (`*_ms`), as briefed.
- `commit_shift_event` additions beyond the brief: P0002 `session_not_found` when the session to update doesn't exist or isn't visible (40001 only when it exists with another revision); 22023 when ids mismatch or `p_session.revision` isn't `expected` or `expected+1`; JSON `null` for `p_session` is treated as purge; purge with `p_expected_revision > 0` is revision-guarded.
- Organization for new rows = `shift_organization_id()`: the caller's earliest active membership holding `shift:track`. Never taken from the payload.
- `shift_events.session_id` and the ledger/achievement `source_session_id` have no FK, so purged sessions keep their history.
- Append-only for users (select + insert only): `shift_events`, `reward_ledger_entries`, `session_revisions`, `user_achievements`. The other profile tables have full CRUD for their owner.
- Fixture moved out of `check-rls.ts` into `supabase/local/shift-fixture.ts` so `check-rls.ts` stays under 800 lines. It runs the real reducer, so the DB is compared with what the app produces.
- Suggest the orchestrator records the audit-log and no-cross-session-constraint decisions in `factory/DECISIONS.md` (I don't own it).

DEPENDENCIES: domain lane's src/lib/shifts/{types,reducer,profile}.ts as of 782b850; template foundation 0001–0004 (unchanged).

KNOWN RISKS:
- Reducer edge case (domain lane): `clock_out` at exactly `startedAt`, and `break_end` (or clock-out closing a break) at exactly the break's start, pass the reducer but violate the DB CHECKs (`ended_at > started_at`, which `validateTimes` also requires). Result: 23514 at commit. Suggest the reducer reject `event.at <= start` for those transitions.
- `projectId` FK: a session that names a project not yet synced to `work_projects` fails with 23503 `shift_sessions_project_fk`. The sync must push projects (profile) before the session events that reference them.
- Location order ties: two fixes with the same `requestedAt` come back ordered by id, while the reducer keeps insertion order. Revisions are ordered by `at`; if two devices with skewed clocks correct the same session, the reducer's append order can differ. Both are rare; the deep-equal would show it.
- Users can call the RPC or tables directly with any session JSON. The DB invariants still hold, but reducer-only rules (cross-session overlap, title/tag cleaning) don't. Only their own data is affected.
- Live `npm run db:check-rls` was NOT run: there is no SHIFTY Supabase project yet, and the SUPABASE_* vars in this environment belong to another product (A01). Local Postgres 16 only.
- `btree_gist` is created `with schema extensions` (Supabase layout). Locally the schema is created by the migration.

TESTS RUN:
- `npm run db:local-check` (local Postgres 16, SUPABASE_* unset)
- `npm run lint` · `npm run typecheck` · `npx vitest run`
- Mutation check (scratch copies): a non-deferrable overlap constraint → the swap-correction step fails (23P01); a session select policy without `user_id = auth.uid()` → peer/admin see 3 sessions, 4 checks FAIL. Both were caught; the copies were discarded.

TEST RESULTS:
- db:local-check: PASS, 76 checks (31 foundation + 45 SHIFTY). Tail:
  ```
  PASS  shift_steps_applied = 22
  PASS  shift_owner_events = 22
  PASS  shift_owner_sees = 41
  PASS  shift_loaded_state = (deep-equal to the expected document)
  PASS  shift_loaded_profile = (deep-equal to the expected document)
  Organization isolation and role rules hold (76 checks, incl. SHIFTY).
  Local migration + RLS check passed (Supabase stub; run npm run db:check-rls against the real project too).
  ```
- lint: clean · typecheck: clean · vitest: 17 files, 101 tests passed
- live db:check-rls: not run: no SHIFTY project / access token (A01)

NEXT AGENT ACTION:
- backend-engineer: call `commit_shift_event` per event after running the reducer on `load_shift_state()`; map errors per docs/SCHEMA.md (23505 + `shift_sessions_one_active_idx` → 409 "A session is already running."; 40001 → 409 reload; P0002 → 404; 23P01/23514 → 400; 23503 project → sync profile first); add `shifty: export_my_shift_data()` to `exportAccountData`.
- security-reviewer: review 0100–0104 (RLS, the `redact_location_events` security definer, capability change).
- domain owner: fix the equal-instant edge case above.
- release-engineer: once SHIFTY's own Supabase project exists, `scripts/release migrate` then `npm run db:check-rls`.

COMMIT: 65aa218 on lane/db (not pushed; no PR)
