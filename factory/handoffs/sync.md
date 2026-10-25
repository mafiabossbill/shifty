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

### 2026-10-25 backend-engineer — SYNC security review fixes (L4, L5, L6, N3)
AGENT: backend-engineer
TASK: SYNC-SEC: security review findings L4, L5, L6, N3 (after merging `claude/relaxed-davinci-y8k5u9`, a fast-forward)
FILES CHANGED:
- `src/app/api/sync/_lib/pipeline.ts`, `src/app/api/sync/_lib/push.ts`, `src/app/api/sync/{events,profile}/route.ts`
- `next.config.ts`, `public/sw.js`
- `src/lib/zod-setup.ts` (new)
- `src/lib/shifts/profile.ts`, `src/lib/shifts/schema.ts`: one import line each; outside my lane, see decisions
- `tests/sync-routes.test.ts`, `tests/sync-csp.test.ts` (new), `tests/sync-sw.test.ts` (new)
WHAT WAS IMPLEMENTED:
- L4: a push batch may reload state at most `MAX_RELOADS_PER_BATCH` = 5 times. A reload happens on a 40001 retry, an RPC duplicate or a 23505. Once the budget is spent, the event that needed another reload and every later event get `rejected server` "Too many conflicts in one sync, try again." They stay on the device and retry on the next sync. The per-event retry limit (3) is unchanged.
- L6: `refuseUnsafeRequest()` runs first in `syncSession(request)` for POST/PUT/PATCH/DELETE:
  - `Sec-Fetch-Site: cross-site` → 403 "This request came from another site, so it was refused."
  - Content-Type not `application/json` (parameters and case ignored; missing counts as not JSON) → 415 "Send the body as JSON (Content-Type: application/json)."
  - same-origin, same-site, none or a missing Sec-Fetch-Site pass. GET is untouched.
  - The device's `src/lib/sync/transport.ts` already sends `application/json`.
- L5: the page CSP is exactly as specified. `'unsafe-eval'` is added only when `NODE_ENV=development`. `connect-src` adds the Supabase origin plus `wss://` (https URLs; `http`/`ws` only for a local project in development). `/sw.js` keeps its stricter `default-src 'self'; script-src 'self'`: its rule now comes after `/:path*`, so it wins.
- N3: `safeNotificationPath()` in `sw.js` keeps only same-origin paths starting with `/`. It refuses `//…`, `/\…` and anything that resolves to another origin (e.g. `/\t/host`). It is applied to the push payload and again on notification click.
IMPORTANT DECISIONS:
- Zod 4 probes `new Function("")` on its first parse. The probe is caught, but under the new CSP the browser still reports `script-src eval`: one violation on every tracking page, seen in the Playwright run. Zod's documented fix is `z.config({ jitless: true })`; parsing results are identical. It lives in `src/lib/zod-setup.ts`, imported first by `src/lib/shifts/profile.ts` and `schema.ts`, the only modules that define Zod schemas used in the browser. Those files are outside my lane: the shifts owner should keep the import, or move it to a client entry they prefer. The only other option was `'unsafe-eval'` in production, which the review rejected.
- The L6 guard runs before the 503/401 checks, so a cross-site write learns nothing about configuration or session.
KNOWN RISKS:
- `DELETE /api/account` (destructive) is not behind the L6 walls; the finding covered the sync pipeline only. Recommendation: call `refuseUnsafeRequest()` there too, and send JSON from the account test helper.
- The CSP's Supabase origin is fixed at build time: setting `NEXT_PUBLIC_SUPABASE_URL` needs a redeploy, as before.
- The browser check covered device mode only; signed-in pages with a real Supabase origin were not exercised.
TESTS RUN:
- `npm run lint`
- `npm run typecheck`
- `npx vitest run`
- `npx next build` from a hard-linked copy, Supabase env unset
- `next start` on :3918, then a Playwright Chromium script (`/opt/pw-browsers/chromium`) on `/`, `/sessions`, `/insights`, `/companion`, `/settings`, `/login`. It listened for `securitypolicyviolation` events and CSP console messages, and counted loaded fonts.
- `curl` against the live server for the L6 walls
TEST RESULTS:
- lint and typecheck: clean.
- vitest: 37 files, 343 tests passed.
- Mutation checks: removing the reload cap fails the L4 test; removing the cross-site and content-type checks fails 2 L6 tests; restoring the old `sw.js` check fails the N3 test.
- Build: OK.
- Playwright, before the Zod fix: 5 pages each had one `script-src eval` violation from Zod's probe. After: zero violations and zero console errors on all 6 pages. next/font fonts loaded under `font-src 'self'` (3 faces, 2 on `/login`), and the service worker activated under `worker-src 'self'`.
- Response headers: pages get the full CSP; `/sw.js` gets its own.
- `curl`: cross-site POST → 403, same-origin POST → 503 (device mode, as expected), text/plain PUT → 415.
NEXT AGENT ACTION:
- shifts/domain owner: accept the `@/lib/zod-setup` import in `profile.ts`/`schema.ts`.
- security-reviewer: re-check L4, L5, L6 and N3, and decide on L6 for `DELETE /api/account`.
COMMIT: see the lane/sync log (`fix(sync): security review L4 L5 L6 N3`)
