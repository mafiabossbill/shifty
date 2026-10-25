# Supabase standard

Detail behind [THE_WAY_BILL_MAKES_APPS.md](../THE_WAY_BILL_MAKES_APPS.md) §8–11. Reference: `templates/nextjs-supabase/src/lib/supabase/`, `supabase/`, `scripts/`.
Tags: **[U]** universal · **[P]** preferred default · **[S]** product-specific.

## 1. Clients [U]
| Client | File | Runs as | Use for | Never |
| --- | --- | --- | --- | --- |
| Server (per request) | `src/lib/supabase/server.ts` | Signed-in user (cookies) → **RLS applies** | Pages, route handlers, repositories | Cache across requests |
| Browser (singleton) | `src/lib/supabase/client.ts` | Signed-in user | Storage uploads, realtime subscriptions | Data reads/writes the API should do |
| Proxy | `src/proxy.ts` | — | Refreshing the session cookie | Authorization decisions |
| Service role | `src/lib/supabase/service.ts` | **Bypasses RLS** | Cron, webhooks, Auth admin calls (create users) | Pages, user-facing routes, client bundles |

Service-role rules [U]:
- Key only in `SUPABASE_SERVICE_ROLE_KEY` (`[secret]`), server-only module (`import "server-only"`), never `NEXT_PUBLIC_`.
- Every query scopes by `organization_id` in code (RLS isn't there to catch mistakes).
- Missing key → 503 with the variable name (`MissingServiceRoleKeyError`), not a crash.
- [P] When a privileged step is needed inside a user action, do only that step with the service role and the rest as the user (`auth.admin.createUser`, then a SQL function as the admin; delete the auth user if step two fails).
- [S] Cloud sessions may have `SUPABASE_DB_URL` + public keys but **no service-role key**: admin paths were tested with mocks and verified live after deploy. Plan for that.

## 2. Sessions [U]
- Server code calls `supabase.auth.getClaims()` (verifies the JWT) — never trust `getSession()` on the server.
- `src/proxy.ts` refreshes the cookie on every request; an Auth network hiccup is retried once, then the request passes through (pages/routes re-check). Turning it into a 500 or `/login` bounce broke background refreshes.
- `getSessionState()` is `cache()`d per request and calls `connection()` first (Cache Components).

## 3. Authorization in Postgres [U]
```sql
-- 0001_foundation.sql
private.role_capabilities(member_role) returns text[]   -- MIRROR of ROLE_CAPABILITIES in permissions.ts
my_organization_ids() returns setof uuid                 -- active memberships of auth.uid()
current_member_role(org uuid) returns member_role
has_capability(org uuid, capability text) returns boolean
```
- All helpers: `stable security definer set search_path = public`, `revoke … from public, anon`, `grant … to authenticated`.
- `tests/permissions.test.ts` parses the SQL map and fails if it differs from `permissions.ts`. Change both in one PR (new migration replacing the function).
- Read policies use `organization_id in (select my_organization_ids())` — Postgres evaluates the subquery once per query (initplan). A per-row `security definer` call cost ~370 ms on 3,000 rows.
- Deactivated members are excluded inside every helper.

## 4. Proving RLS [U]
| Check | Command | When |
| --- | --- | --- |
| Local (Postgres 16 + `supabase/local/supabase-stub.sql`) | `npm run db:local-check` | Every migration, every PR (CI `database` job) |
| Live (real project, Management API) | `npm run db:check-rls` | After applying migrations to any project; release gate |
How it works (`scripts/check-rls.ts`): one `DO` block creates throwaway users/orgs, impersonates each (`set local role authenticated` + `request.jwt.claims`), records counts and denials, then **raises** its results so everything rolls back. Extend it for every new table: outsider sees/changes nothing; each role can do exactly its capabilities; last-admin and bootstrap rules hold.

## 5. Storage [P]
- Private buckets; size and MIME limits set **on the bucket** (`file_size_limit`, `allowed_mime_types`).
- Object path `<organization_id>/<entity_id>/<uuid>-<filename>`; storage policies parse the first segments (`split_part(name, '/', 1)`) and call SQL helpers (e.g. `can_read_attachment_path()`, `can_write_attachment_path()`).
- Browser uploads straight to Storage as the user, then registers metadata via the API; reads via **short-lived signed URLs** (≤1 hour).
- Avatars/logos: separate bucket, own-folder writes, org reads.

## 6. Realtime [P]
- Add tables to `supabase_realtime` publication in a migration; subscribe with `filter: organization_id=eq.<org>`; RLS applies to every event.
- Call `supabase.realtime.setAuth(access_token)` before subscribing; one channel per org per page tree; remove on unmount.
- Events trigger a background revalidate (debounced), never a full reload; ignore echoes of the user's own optimistic writes.

## 7. Scheduled jobs: pg_cron + pg_net + Vault [P]
Why: Vercel Hobby cron is daily-only; pg_cron runs every minute (reports land within a minute of their configured time).

| Step | Rule |
| --- | --- |
| Migration | `private.trigger_<job>_cron()` reads URL + secret from `vault.decrypted_secrets`, `net.http_get(url, Authorization: Bearer <secret>)`; returns null (no-op) when secrets are missing; `cron.schedule('<app>-<job>', '<cron>', …)` (same name = update) — template `supabase/optional/cron.sql.example` |
| Configure | After deploy, store `<app>_app_url` + `<app>_cron_secret` in Vault (`npm run db:cron`); never in SQL files |
| Route | `/api/cron/<job>`: 503 if `CRON_SECRET` unset, 401 unless constant-time match (`src/lib/cron-auth.ts`), idempotent per period |
| **Verify** | `cron.job_run_details` says **Succeeded even when the function no-oped** for missing Vault secrets. Always check the HTTP side: `select created, status_code, error_msg from net._http_response order by created desc limit 5;` |
| Domain/secret change | Re-run the Vault configuration; old URL keeps failing silently otherwise |
| Deployment protection | Production URLs called by cron must not be behind Vercel protection |

## 8. Auth settings (dashboard) [U]
| Setting | Value |
| --- | --- |
| Email confirmation | On |
| **SMTP** | Custom SMTP on the company domain **before inviting staff** — Supabase's built-in mailer only delivers to project team members and is rate-limited |
| Site URL | Production URL; updated when the domain goes live ([DOMAIN_STANDARD.md](DOMAIN_STANDARD.md)) |
| Redirect URLs | Production domain + `https://*-<team>.vercel.app/**` for previews + `http://localhost:3000/**` (dev project only) |
| Password reset | App uses the **implicit flow** (`flowType: "implicit"`) so the link works on any device; PKCE links only work in the requesting browser |
| Minimum password | 8+ (app enforces the same: `src/lib/auth-rules.ts`) |
| Leaked-password protection | On where the plan allows |

## 9. People and first admin [U]
- **First admin**: `ADMIN_EMAIL=… ORG_NAME=… npm run db:configure` stores the email in `private.app_settings` and creates the first org; the first **confirmed** sign-in with that email claims Admin through `claim_admin_bootstrap()` (once). No hardcoded credentials, no service role.
- **Invites** [P]: admin records email + role; person signs up; `claim_invite()` on confirmed email.
- **Admin-created people** [P]: for staff who never log in (executives on WhatsApp) — placeholder emails at a `.invalid` domain, flag `email_is_placeholder`; temporary passwords set `must_change_password` (pages redirect, APIs 403 until changed).
- **Deactivate**, never delete; last-admin guard trigger.

## 10. Environments [U]
| Environment | Supabase project | Notes |
| --- | --- | --- |
| Development | dev project | Seeds and demo data allowed |
| Preview (per PR) | dev project (or a staging project when previews must not share data) | Never production data |
| Production | prod project | No demo data; migrations only through `scripts/release migrate` |
- Region next to the Vercel function region (e.g. Europe + `dub1`).
- Keep project refs in `factory/STATE.md`; keys never.

## 11. Migrations without a Postgres connection [P]
- `scripts/sql.ts` sends SQL to the **Management API** (`POST /v1/projects/{ref}/database/query`) with `SUPABASE_ACCESS_TOKEN` — works from cloud sessions and CI where port 5432 is blocked.
- `scripts/migrate.ts` writes the same `supabase_migrations.schema_migrations` table as the Supabase CLI, so `npx supabase db push --db-url "$SUPABASE_DB_URL"` agrees.
- `LOCAL_DATABASE_URL` switches `sql()` to `psql` for the local check.
- Revoke personal access tokens when no longer needed.

## 12. Maintenance [P]
- Run Supabase **advisors** (security + performance) after big migrations and monthly; fix "RLS disabled", "function search_path mutable", unindexed FKs.
- Watch `net._http_response` for cron failures; prune old notifications, webhook events and messages on a schedule.
- Upgrade `@supabase/ssr` / `supabase-js` deliberately; re-run auth flows (login, reset on phone, invite) after upgrades.

## 12b. Added after the simulations
| Topic | Rule |
| --- | --- |
| Cron status [U] | `npm run db:cron` stores the app URL + `CRON_SECRET` in Vault; `npm run db:cron -- --status` shows jobs, secrets present, runs and **`net._http_response` codes** (the only proof the app was called) |
| Media from phones [P] | Compress in the browser before upload (`compressImage()` in `src/lib/uploads.ts`: longest side 1600px, JPEG 0.8, drops EXIF/GPS — store location separately if the product needs it); path `<org>/<entity>/<uuid>-<name>`; private bucket with size/MIME limits (`supabase/optional/storage.sql.example`); signed URLs ≤ 1 h; hash the bytes when evidence matters; queue uploads offline like any other write |
| SaaS tenancy [P] | Default is company tenancy (one org from `db:configure`, people join by invite). Self-serve SaaS: `scripts/bootstrap --saas` installs `create_organization()` as `0003_workspaces.sql` (confirmed email, ≤5 per person, slug generated) and turns on `/onboarding` (instead of `/no-access`), `POST /api/workspaces` and "New workspace" in the switcher; check-rls proves it |
| Team [U] | Invites (`organization_invites` + `claim_invite()` on confirmed email), `team_directory()` with emails only for `member:manage`, deactivation instead of deletion, last-admin guard — all in the template (`0002_team_invites.sql`, `/settings/team`) |

## 13. Checklist
- [ ] User-facing code uses the server client; service role only in cron/webhook/auth-admin
- [ ] `getClaims()` on the server; proxy matcher excludes PWA files
- [ ] SQL capability map == `permissions.ts` (test green)
- [ ] `db:local-check` and live `db:check-rls` green after migrations
- [ ] Buckets private with limits; signed URLs short-lived
- [ ] Cron verified via `net._http_response`, not "Succeeded"
- [ ] SMTP on the company domain; Site URL/redirects on the production domain
- [ ] First admin via `ADMIN_EMAIL`; no demo data in production

Related: [DATABASE_STANDARD.md](DATABASE_STANDARD.md) · [SECURITY_STANDARD.md](SECURITY_STANDARD.md) · [../checklists/database.md](../checklists/database.md)
