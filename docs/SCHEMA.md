# SHIFTY schema

Database contract for SHIFTY's sessions and profile data. Migrations `0100`–`0104` (database-engineer range
0100–0199) build on the template foundation `0001`–`0004`. The domain types are in
[src/lib/shifts/types.ts](../src/lib/shifts/types.ts) and [src/lib/shifts/profile.ts](../src/lib/shifts/profile.ts);
the database stores them as they are.

| File | Contents |
| --- | --- |
| `0100_shift_capabilities.sql` | `shift:track` added for admin and member (full `private.role_capabilities()` map) |
| `0101_shift_profile.sql` | `work_projects`, `saved_places`, `user_settings`, `companion_states`, `reward_ledger_entries`, `user_achievements`, `activities` |
| `0102_shift_sessions.sql` | Enums, ms ↔ timestamptz helpers, `shift_sessions`, `shift_breaks`, `location_snapshots`, `session_revisions`, `shift_events`, rule constraints |
| `0103_shift_functions.sql` | `commit_shift_event`, `load_shift_state`, `load_shift_session`, `shift_session_json`, `delete_location_fixes`, `redact_location_events`, `shift_organization_id` |
| `0104_shift_account.sql` | `load_profile_state`, `export_my_shift_data` (account export); account deletion documented (cascade) |

## Privacy and tenancy
| Rule | How |
| --- | --- |
| A person sees only their own tracking. Admins don't see anyone else's either. | Every policy on every SHIFTY table is `user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track')` |
| Only admin and member roles track shifts | `shift:track` in `src/lib/permissions.ts` and `private.role_capabilities()` (`tests/permissions.test.ts` compares the two) |
| Rows can't cross people or organizations | Children use the composite FK `(organization_id, user_id, session_id) → shift_sessions (organization_id, user_id, id)`; sessions name projects through `(organization_id, user_id, project_id) → work_projects` |
| No admin-readable copy of tracking data | No `audit_logs` trigger on SHIFTY tables (`audit_logs` can be read with `audit:view`). History lives in `session_revisions` and `shift_events`, which only the owner can read |
| Append-only for the owner | `shift_events`, `reward_ledger_entries`, `session_revisions`, `user_achievements`: select + insert policies only. Rows go with their session (purge) or account |
| The organization never comes from the payload | `commit_shift_event` uses `shift_organization_id()` (the caller's earliest active membership with `shift:track`) and `auth.uid()` |

## Instants
Domain instants are epoch milliseconds (UTC). Session tables store them as `timestamptz`, which has microsecond
precision, so milliseconds survive exactly.

| Direction | Function | Definition |
| --- | --- | --- |
| ms → timestamptz | `ms_to_timestamptz(bigint)` (immutable) | `to_timestamp(ms::double precision / 1000)` |
| timestamptz → ms | `timestamptz_to_ms(timestamptz)` (stable) | `(extract(epoch from ts) * 1000)::bigint` |

The live check proves it: 0 mismatches over every millisecond of three whole seconds (at 2000-01-01, 2025-10-25 and
2099-12-31), both ends of the accepted range (2000–2100), and 200,000 random instants.

Profile tables keep the device's version stamps as `bigint` milliseconds (`updated_ms`, `awarded_ms`, `earned_ms`,
`at_ms`). They are last-write-wins markers and ledger keys, not times anyone reports on.

`shift_sessions.client_created_at` / `client_updated_at` hold the domain's `createdAt` / `updatedAt` (device event
times). The row's own `created_at` / `updated_at` are server times kept by `set_updated_at`.

## Tables
Every table has `organization_id uuid not null references organizations on delete cascade`,
`user_id … references profiles (id) on delete cascade`, `created_at` / `updated_at` with a `set_updated_at` trigger,
and RLS turned on in the migration that creates it.

| Table | Key | Domain type | Notable columns and constraints | Indexes |
| --- | --- | --- | --- | --- |
| `shift_sessions` | `id` (= ShiftSession.id) | ShiftSession | `origin shift_origin`, `goal_seconds` 60…172800, `title` ≤120, `notes` ≤4000, `tags` ≤12 (no nulls), `currency ~ '^[A-Z]{3}$'`, `mood`/`energy` 1…5, `flags ⊆ {device_clock_ahead, device_clock_behind, timezone_changed}`, `revision ≥ 1`, zones 1…64 chars; `shift_sessions_chronology` (`ended_at > started_at`); immutable: id, organization, user, `origin_event_id`, `original_started_at`, `origin`, `client_created_at` | `shift_sessions_one_active_idx` UNIQUE `(user_id) where ended_at is null and deleted_at is null`; `(user_id, started_at desc)`; trash `(user_id, deleted_at)`; project `(organization_id, user_id, project_id)` |
| `shift_breaks` | `id` | ShiftBreak | `kind shift_break_kind`; `shift_breaks_chronology`; `shift_breaks_no_overlap` EXCLUDE gist `(session_id =, tstzrange(started_at, coalesce(ended_at, infinity), '[)') &&)` deferrable; constraint triggers `shift_breaks_within_session` / `shift_sessions_breaks_within` (deferrable) | `(session_id, started_at)`, `(user_id)` |
| `location_snapshots` | `id` | LocationFix | `event location_event_kind`, `status location_status`; `location_snapshots_coordinates`: `captured` ⇔ latitude and longitude set; lat −90…90, lng −180…180, `accuracy_m ≥ 0`, `place_label` ≤80 | `(session_id, requested_at)`, `(user_id, requested_at desc)` |
| `session_revisions` | `id` (= correcting event id) | SessionRevision | `edited_at` (= `at`), `reason` 3…500 after trim, `previous` / `updated` jsonb TimeSnapshot stored as sent | `(session_id, edited_at)`, `(user_id)` |
| `shift_events` | `id` (= device event id) | ShiftEvent | `session_id` **no FK** (a purged session keeps its events), `type` ∈ the 13 event types, `happened_at` (= `at`), `recorded_at` (= `recordedAt`), `received_at default now()`, `device_time_zone`, `payload` (the event as sent), `flags` | `(user_id, recorded_at desc)`, `(session_id, recorded_at)` |
| `work_projects` | `id`; unique `(organization_id, user_id, id)` | Project | `name` 1…60, `color` ∈ palette, `archived`, `updated_ms` | `(user_id, archived, name)` |
| `saved_places` | `id` | Place | `label` 1…40, lat/lng ranges, `radius_m` 25…5000, `updated_ms` | `(user_id, label)` |
| `user_settings` | `user_id` | Settings | `settings` jsonb object (Zod-validated in the API), `updated_ms` | PK |
| `companion_states` | `user_id` | Companion | `state` jsonb object, `updated_ms` | PK |
| `reward_ledger_entries` | unique `(user_id, event_key)` | LedgerEntry | `rule` ≤40, `xp` −1000…1000, `source_session_id` (no FK), `awarded_ms` | `(user_id, awarded_ms)` |
| `user_achievements` | `(user_id, code)` | EarnedAchievement | `earned_ms`, `source_session_id` (no FK) | PK |
| `activities` | `(user_id, id)` | Activity | `type` ∈ week_review / export / streak_freeze_used, `key` ≤40, `at_ms` | `(user_id, at_ms desc)` |

Sessions of one person may overlap. The reducer allows an overlap the person explicitly confirms (`allowOverlap`), so
cross-session overlap is checked in the domain layer only. The database enforces just the one-running-session rule.

## RPC contract
All functions are `security invoker` (RLS applies) and executable by `authenticated` only. The one exception is
`redact_location_events`: it is `security definer` because it rewrites the caller's own append-only events, and its
WHERE clause is limited to `auth.uid()`.

### `commit_shift_event(p_event jsonb, p_session jsonb, p_session_id uuid, p_expected_revision integer, p_flags text[] default '{}') returns jsonb`
Runs in one transaction:
1. Caller: `auth.uid()` (42501 if signed out); organization: `shift_organization_id()` (42501 if the caller lacks `shift:track`).
2. Checks that `p_event.sessionId` and `p_session.id` equal `p_session_id` (22023 otherwise).
3. `insert into shift_events … on conflict (id) do nothing`. If the event id is already stored, it returns `{"status":"duplicate"}` and changes nothing.
4. `p_session` null (SQL or JSON null) means **purge**: the session row is deleted, and its breaks, locations and revisions cascade. If `p_expected_revision > 0` and the stored revision differs: 40001. Coordinates in that session's `location` events are redacted.
5. `p_expected_revision = 0` means **insert** (a reused id fails with 23505 `shift_sessions_pkey`). Otherwise it is an **update** `where id = p_session_id and user_id = auth.uid() and revision = p_expected_revision`. `p_session.revision` must be `expected` or `expected + 1` (22023). With 0 rows updated: the session exists → 40001 `revision_conflict`; it doesn't exist or isn't visible → P0002 `session_not_found`.
6. Children are synced to `p_session`: breaks and locations not present are deleted, changed ones updated, new ones inserted. Removed fixes are redacted in the event log. Revisions not yet stored are inserted (append-only).
7. `set constraints … immediate`: the overlap and within-session checks run here, at the end, so one correction can move or swap several breaks.
8. Returns `{"status":"applied","revision":<p_session.revision | null on purge>}`.

`p_session` uses the ShiftSession keys exactly (camelCase): `id, originEventId, originalStartedAt, startedAt, endedAt,
origin, reportingTimeZone, startTimeZone, endTimeZone, goalSeconds, title, notes, projectId, tags, payRateMinor,
currency, mood, energy, breaks[], locations[], revisions[], flags[], archivedAt, deletedAt, revision, createdAt,
updatedAt`. The stored `organization_id` / `user_id` never come from the payload.

### `load_shift_state() returns jsonb`
Returns the caller's ShiftState, trash included: `{"sessions": {"<id>": ShiftSession, …}}` (`{"sessions": {}}` when
empty). `JSON.parse` of it deep-equals the reducer's state; the live check compares the two after a 22-event fixture.

### `load_shift_session(p_session_id uuid) returns jsonb`
Returns one ShiftSession, or null if it doesn't exist or isn't the caller's.

### ShiftSession JSON (built by `shift_session_json(shift_sessions)`)
```json
{
  "id": "uuid", "originEventId": "uuid", "originalStartedAt": 1792422000123, "startedAt": 1792421100124,
  "endedAt": 1792479601122, "origin": "timer", "reportingTimeZone": "Africa/Dar_es_Salaam",
  "startTimeZone": "Africa/Dar_es_Salaam", "endTimeZone": "Africa/Dar_es_Salaam", "goalSeconds": 57600,
  "title": "Night shift", "notes": "", "projectId": "uuid|null", "tags": ["ward 3"], "payRateMinor": 250000,
  "currency": "TZS", "mood": 4, "energy": null,
  "breaks": [{ "id": "uuid", "startedAt": 0, "endedAt": 0, "kind": "meal" }],
  "locations": [{ "id": "uuid", "event": "clock_in", "status": "captured", "requestedAt": 0, "capturedAt": 0,
                  "latitude": -6.792354123456789, "longitude": 39.20832871234567, "accuracyM": 12.5, "placeLabel": "Clinic" }],
  "revisions": [{ "id": "uuid", "at": 0, "reason": "…", "previous": { "startedAt": 0, "endedAt": 0, "breaks": [] },
                  "updated": { "startedAt": 0, "endedAt": 0, "breaks": [] } }],
  "flags": [], "archivedAt": null, "deletedAt": null, "revision": 9, "createdAt": 0, "updatedAt": 0
}
```
All instants are epoch-ms numbers or `null`. Coordinates are `double precision`, written shortest-exact
(`extra_float_digits = 1`). Array order: breaks by `startedAt`, locations by `requestedAt`, revisions by `at`; ties
are broken by id.

### `delete_location_fixes(p_session_id uuid default null) returns integer`
Deletes the caller's location fixes, for one session or for all of them, and returns how many it deleted. It adds 1
to the `revision` of each session it changed and sets `updatedAt` to now (ms), so a device holding the old revision
gets a 40001 and reloads instead of sending the fixes again. It also redacts the coordinates in the matching
`location` events.

### `redact_location_events(p_session_id uuid default null, p_fix_ids uuid[] default null) returns integer`
For the caller's own `location` events, sets `payload.fix.latitude/longitude/accuracyM/placeLabel` to null and adds
the flag `location_redacted`. `commit_shift_event` and `delete_location_fixes` call it; it is harmless to call
directly.

### `load_profile_state() returns jsonb` · `export_my_shift_data() returns jsonb`
`load_profile_state()` returns the ProfileState shape: `{settings|null, projects[], places[], activities[],
companion|null, ledger[], achievements[]}`, with the camelCase keys from `profile.ts`.
`export_my_shift_data()` returns `{sessions: ShiftSession[] (oldest first), events: [{id, type, sessionId, at,
recordedAt, receivedAt, deviceTimeZone, flags, payload}], profile: load_profile_state()}`.

## Error codes (for the API's mapping)
| SQLSTATE | Where | Meaning | Suggested HTTP |
| --- | --- | --- | --- |
| `23505` + `shift_sessions_one_active_idx` in the message and constraint | insert / restore | A session is already running | 409 "A session is already running." |
| `23505` + `shift_sessions_pkey` / `shift_breaks_pkey` / `location_snapshots_pkey` | insert | Id reused (another device created it, or a bug) | 409 |
| `40001` `revision_conflict` | update / purge | Stored revision ≠ expected | 409: reload, re-run the reducer |
| `P0002` `session_not_found` | update | No such session for this person | 404 |
| `23P01` `shift_breaks_no_overlap` | end of commit | Two breaks of one session overlap | 400/409 chronology |
| `23514` `shift_sessions_chronology` / `shift_breaks_chronology` | write | End not after start | 400 |
| `23514` `shift_breaks_within_session` | end of commit | Break outside the session, two open breaks, or an open break in a finished session | 400 |
| `23514` `location_snapshots_coordinates` | write | Captured without coordinates, or coordinates without capture | 400 |
| `23514` `shift_sessions_immutable` | update | Owner, origin or original start changed | 400 |
| `23514` (other CHECKs) | write | Goal, rating, currency, length limits | 400 |
| `23503` `shift_sessions_project_fk` | write | `projectId` isn't one of this person's projects (sync projects first) | 409 |
| `22023` | commit | Ids don't match, revision didn't advance by 0/1, malformed arguments | 400 |
| `42501` | commit | Signed out, or no `shift:track` in any workspace | 401 / 403 |

## Account deletion and export
- **Deletion**: `delete_own_account()` (0004) is unchanged. It deletes `auth.users` → `profiles`, and every SHIFTY
  table cascades from `profiles` (children also cascade from their session and organization). The live check proves
  `shift_account_rows_left = 0` across all 12 tables.
- **Export**: `GET /api/account/export` (`src/lib/data/account.ts`, backend lane) should add
  `shifty: (await supabase.rpc("export_my_shift_data")).data`.

## Proof
`npm run db:local-check` (local Postgres 16) and `npm run db:check-rls` (live project) run `scripts/check-rls.ts`.
The SHIFTY section builds 22 events with the real reducer (`supabase/local/shift-fixture.ts`) and commits each one.
It then checks every row in the error table, isolation from a peer, a same-org admin, an outsider, a viewer and
anon, the append-only tables, ledger key uniqueness, location redaction, the ms round trip, and account-deletion
cascade. Finally it deep-compares `load_shift_state()` / `load_profile_state()` with the reducer's output.
