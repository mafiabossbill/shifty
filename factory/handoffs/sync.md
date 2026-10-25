### 2026-10-25 backend-engineer — SYNC server sync API

AGENT: backend-engineer
TASK: SYNC — server sync routes, shift repository + memory twin, device-mode proxy, account export

FILES CHANGED:
- `src/app/api/sync/{status,state,events,profile}/route.ts`, `src/app/api/sync/_lib/{pipeline,push}.ts` (new)
- `src/lib/data/shifts.ts`, `src/lib/data/shifts-memory.ts` (new); `src/lib/data/account.ts`
- `src/app/api/account/route.ts`, `src/app/api/account/export/route.ts`
- `src/proxy.ts`, `src/lib/public-paths.ts`, `src/lib/supabase/env.ts`, `src/lib/validation.ts`, `.env.example`
- `src/app/(auth)/layout.tsx`, `src/app/auth/callback/route.ts` (small device-mode guards)
- `tests/sync-routes.test.ts`, `tests/sync-repository.test.ts`, `tests/sync-proxy.test.ts`, `tests/sync-schema.test.ts` (new); `tests/public-paths.test.ts`, `tests/account.test.ts` (env stub + one device-mode case)

WHAT WAS IMPLEMENTED:
- Device mode works: with no Supabase env the proxy passes everything through (no client is created), `/login` and `/signup` say "Sync isn't set up on this deployment" with a link home, `/auth/callback` goes to `/login`, and `/api/sync/*` and `/api/account*` answer 503 with what to set.
- Signed-out visitors get the tracking shell (`/`, `/sessions/**`, `/insights`, `/companion`, `/settings/**`). Only account-only pages (`/dashboard`, `/no-access`, `/onboarding`) still go to `/login?next=`, and only when sync is configured. When configured, the auth cookie is refreshed on every request as before.
- Endpoints. Order in every route: configured → session → `shift:track` → Zod → repository. Every response has `Cache-Control: no-store`.

  | Method + path | Body | Status codes |
  | --- | --- | --- |
  | `GET /api/sync/status` | — | always 200 `{data:{configured, signedIn, userId, email, serverTime}}`; no Supabase call when not configured |
  | `GET /api/sync/state` | — | 200 `{data:{sessions, profile, serverTime}}` · 401 · 403 · 503 · 500 load failed |
  | `POST /api/sync/events` | `{events: unknown[1..100]}` strict | 200 `{data:{results, serverTime}}` with one result per event in order · 400 bad batch / >100 / unknown field · 401 · 403 · 503 · 500 load failed |
  | `PUT /api/sync/profile` | `ProfilePutRequest`, every part `.strict()`, at least one part | 200 `{data:{ok:true, serverTime}}` · 400 (unknown field incl. `user_id` / `organization_id`, invalid value, empty) · 401 · 403 · 503 · 500 |

- Push, per event: `parseShiftEvent` (if it fails: `rejected validation`; when the event has no id the result id is `#<index>`) → already committed? `duplicate` with the current server session → `applyEvent` (the reducer's code, message and `conflictingSessionId` are passed through) → `commit_shift_event` with `expected` = loaded revision (0 when new) → state updated in memory for the rest of the batch. `40001`: reload, re-run the reducer, up to 3 retries, then `rejected server` "Another device changed this session at the same moment. Sync again to retry." `23505`: reload; `active_exists` naming the running session, otherwise `validation` "This id is already used." `23P01`/`23514`: `chronology`. `42501`: `forbidden`. Anything else, or a thrown error: `rejected server` plus a log line (ids/codes only). `device_clock_ahead` is added to `session.flags` and to `p_flags` when `event.at > serverNow + 2 min`; times never change.
- Profile: settings, companion, projects and places use last write wins (overwrite when incoming `updatedAt` ≥ stored). Activities, ledger and achievements are insert-only, and duplicates are ignored (`user_id,id` · `user_id,event_key` · `user_id,code`). `user_id`/`organization_id` always come from the session.
- `/api/account/export` adds `shifty: {sessions (trash and location fixes included), settings, companion, projects, places, activities, ledger, achievements, events_committed}`.

IMPORTANT DECISIONS:
- Duplicate check before the reducer, using `shift_events` (`select id … in (ids)`, one query per batch). Without it, replaying a batch whose session has finished gets `invalid_state` from the reducer instead of `duplicate`. The RPC's own `{"status":"duplicate"}` stays as the backstop for races. After a reload, a reducer rejection re-checks the id once, so a clock-out pushed from two tabs reports duplicate, not a rejection.
- Duplicate outcomes, DB constraint codes and batch-level problems are not HTTP errors: POST answers 200 with per-event results (contract.ts). Blueprint R06 says "stale correction → 409"; per contract.ts it is `rejected revision_mismatch` inside a 200. `ERROR_STATUS` stays available for single-event endpoints.
- `shift:track` is checked in one place: `canTrackShifts()` in `src/app/api/sync/_lib/pipeline.ts`. It reads `ROLE_CAPABILITIES` as strings, so it compiles before the DB lane's permissions change. Route tests extend the map with a `vi.mock` until then.
- Table and RPC names live in `SHIFT_TABLES` / `SHIFT_RPC` in `shifts.ts`. Because they're constants, `schema-references.test.ts` can't see them, so `tests/sync-schema.test.ts` checks them once any 0100–0199 migration exists. Until then it is skipped, not passed.
- Data is per person: queries filter by `user_id` (plus RLS). `organization_id` is only stamped on writes. `load_shift_state()` returns all the caller's sessions across workspaces, as specified.
- Order is session → capability → Zod, so a forbidden caller never sees validation details.
- `profile.ts` schemas are plain `z.object`. I didn't edit them: `validation.ts` applies `.strict()` on top.
- GET handlers call `connection()` (Cache Components), and the tests stub it.

DEPENDENCIES:
- database-engineer (0100–0199): `commit_shift_event(p_event, p_session, p_session_id, p_expected_revision, p_flags)` and `load_shift_state()` exactly as briefed. Also assumed: `shift_events(id uuid unique, user_id, …)` readable by its owner under RLS. Its rows must survive a purge (no cascade, or a tombstone), otherwise a replayed clock-in after a purge would resurrect the session. The memory twin keeps event ids after a purge, and a test proves the replay is a duplicate. Assumed conflict targets: `user_settings.user_id`, `companion_states.user_id`, `work_projects.id`, `saved_places.id`, `activities(user_id,id)`, `reward_ledger_entries(user_id,event_key)`, `user_achievements(user_id,code)`; documents are stored in `user_settings.settings` / `companion_states.state` jsonb. `p_session` already carries the server flag; the DB should store it as-is (merging `p_flags` must be idempotent).
- `shift:track` for admin and member in `permissions.ts` and in the SQL mirror. Until that lands, every real request gets 403.

KNOWN RISKS:
- Template pages `/`, `/settings`, `/settings/account`, `/settings/team` and `/dashboard` call `getSessionState()`/`requireSession()`. In device mode these throw `NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.` I saw this in the `next start` log with no Supabase env. The pages answer 200, then the stream errors. Fix: the UI lane replaces them with IndexedDB shells, and/or the owner of `current-user.ts` adds `if (!supabaseConfigured()) return { status: "anonymous" }` at the top of `getSessionState` (recommended; I don't own that file).
- `next.config.ts` sends `Permissions-Policy: geolocation=()`, which blocks the Geolocation API on every page, so clock-in location will always fail. It needs `geolocation=(self)`. I don't own `next.config.ts`.
- Last write wins for projects and places is read-then-upsert, and documents use a conditional update then an insert that ignores duplicates. Not atomic: two of the same person's devices writing in the same instant could let the older row win. Profile parts aren't one transaction; each step is idempotent, so resending the whole PUT is safe.
- Device-mode detection in `(auth)/layout.tsx` is fixed at build time (`NEXT_PUBLIC_*` are inlined and `/login` is prerendered). Setting the Supabase variables in Vercel needs a redeploy, which `NEXT_PUBLIC_*` need anyway.
- `syncBatchSchema` in `schema.ts` allows 200 events, but `MAX_PUSH_BATCH` is 100. The routes use 100 (`validation.ts`). The blueprint names `commit_shift_events()` (plural) and a state cursor; I followed the brief and contract.ts (singular, no cursor).
- The Supabase implementation is tested against a recording fake client (parameter names, error mapping, paging, owner fields), not a real database. Once the DB lane lands, it needs a live/local check.
- In this worktree `npx next build` fails because Turbopack refuses the symlinked `node_modules` (it resolves outside the root). I built from a scratch copy with a hard-linked `node_modules`.

TESTS RUN:
- `npm run lint`
- `npm run typecheck`
- `npx vitest run`
- `npx next build` (scratch copy of this tree, Supabase env vars unset)
- `next start` smoke on :3917 with no Supabase env: `curl` of `/api/sync/status`, `/api/sync/state`, `POST /api/sync/events`, `/login`

TEST RESULTS:
- lint: clean. typecheck: clean.
- vitest: 21 files passed, 1 skipped (sync-schema, waiting for the 01xx migrations); 140 tests passed, 2 skipped.
- Mutation check: switching off the duplicate pre-check fails tests G and purge; switching off the clock-ahead flag fails the flag test.
- Build: succeeds; `/api/sync/*` are dynamic (ƒ); the prerendered `/login` contains "Sync isn't set up on this deployment".
- Smoke: status 200 `{"configured":false,…}` no-store; state 503 with the sentence; events 503.
- No call was made to the Supabase project in this environment: env is stubbed in tests and unset for build and start.

NEXT AGENT ACTION:
- database-engineer: confirm or rename the assumed names and columns (`shift_events.user_id`, conflict targets, jsonb columns) in `SHIFT_TABLES`. Keep `shift_events` rows after a purge. Add `shift:track` to `permissions.ts` and the SQL mirror. Then replace `canTrackShifts()` with `can(user, "shift:track")` and drop the permissions `vi.mock` in `tests/sync-routes.test.ts`.
- frontend-engineer: device-shell pages must not call `requireSession`/`getSessionState` when `supabaseConfigured()` is false (see risk 1). Use `/api/sync/status` to decide between "On this device" and sync. Treat `rejected server` as retryable and the other rejections as Needs attention.
- devops / ux-architect: change `Permissions-Policy` to `geolocation=(self)` in `next.config.ts`.
- security-reviewer: review the sync API and the device-mode public shell.

COMMIT: 9189c42 on lane/sync (handoff in the following docs commit; not pushed)
