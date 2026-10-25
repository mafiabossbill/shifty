# Deployment standard

Vercel + Supabase environments, CI and rollback. Doctrine: [THE_WAY_BILL_MAKES_APPS.md](../THE_WAY_BILL_MAKES_APPS.md) §27–28.
Tags: **[U]** universal · **[P]** preferred default · **[S]** product-specific.

## 1. Environments [U]

| Environment | App | Database | Env vars | Who deploys |
| --- | --- | --- | --- | --- |
| Development | `npm run dev` (local or cloud session) | Supabase **dev** project | `.env.local` (never committed) | Anyone |
| Preview | Vercel, one URL per PR/branch | Supabase **dev** (or a staging project when data must be isolated) | Vercel "Preview" scope | Vercel on push |
| Production | Vercel, production domain | Supabase **prod** project | Vercel "Production" scope | Vercel on merge to `main`, after the release gate |

- [U] Production database and keys are never used from a laptop, a preview or a cloud session except through `scripts/release migrate` with the project ref confirmed twice.
- [P] One Supabase project per environment; preview shares dev unless a client demo or real data requires isolation.

## 2. Vercel project setup (once per app) [P]
Kit: [../templates/vercel/README.md](../templates/vercel/README.md).
1. Import the GitHub repo; framework Next.js; root = repo root; Node 22.
2. Production branch `main`; every PR gets a preview.
3. Region next to the Supabase project, not the users (`vercel.json` `regions`; e.g. `dub1`).
4. Environment variables per scope from `.env.example` (§3).
5. Expose system env vars (the health endpoint reports `VERCEL_GIT_COMMIT_SHA` and `VERCEL_ENV`).
6. Deployment Protection: fine for previews (CI smoke needs the bypass secret); **never** on production URLs that pg_cron or webhooks call.

## 3. Environment variables per environment [U]
Classes come from the tags in `.env.example`; validate with [../scripts/env-check](../scripts/env-check).

| Class | Development | Preview | Production |
| --- | --- | --- | --- |
| `[public]` Supabase URL / anon key | dev project | dev/staging project | prod project |
| `[public]` `NEXT_PUBLIC_SITE_URL` | unset | unset (request origin) | final https domain, **only once DNS is live** |
| `[server]` e.g. `APP_TIMEZONE` | optional | as prod | set |
| `[secret]` service role, `CRON_SECRET`, provider tokens | only if needed locally | preview values or unset (feature reports "not configured") | prod values |
| `[scripts]` access token, `ADMIN_EMAIL`, E2E | local shell / CI secrets | never in Vercel | never in Vercel |

- [U] Values are entered in the Vercel dashboard or cloud environment settings by Bill; never pasted in chat, never committed. A pasted secret is exposed: rotate it.
- [U] `scripts/env-check --env-file <pulled file> --environment production` before a release.

## 4. Vercel Hobby limits (real, plan for them) [U]
| Limit | Consequence | Standard answer |
| --- | --- | --- |
| Cron at most once a day | Reports/alerts can't run on time | Supabase **pg_cron + pg_net + Vault** calling `/api/cron/*` with `CRON_SECRET` (template `supabase/optional/cron.sql.example`) |
| Runtime logs kept ~1 hour | Evidence disappears | Trigger the action, read logs immediately, save the relevant lines in the handoff |
| CLI/dashboard can fail silently | A silent CLI error led to a wrong "nothing is running" diagnosis | Confirm every conclusion with a second source: HTTP response, DB row, `net._http_response` |
| Function duration caps | PDF rendering or slow providers time out | `export const maxDuration = 60` on those routes; keep work small |
| File tracing | Assets read at runtime (fonts, logos) missing in functions | `outputFileTracingIncludes` in `next.config.ts` (e.g. report PDFs) |

## 5. CI [U]
Workflow: [../templates/github/workflows/ci.yml](../templates/github/workflows/ci.yml), installed by `scripts/bootstrap`.

| Job | Trigger | Steps |
| --- | --- | --- |
| `check` | PR, push to main | `npm ci`, lint, typecheck, test, build |
| `database` | PR, push to main | `npm run db:local-check` (migrations + RLS on local Postgres) |
| `smoke` | `deployment_status: success` | Playwright smoke against the deployment URL |

- [U] A PR is reviewable only when CI is green; Bill merges.
- [P] Every factory app gets CI from `templates/github`; checks inside sessions and Vercel's build are not enough on their own.

## 6. Cloud-session constraints [U]
- Cloud environments usually have `SUPABASE_DB_URL`/public keys but **no service-role key**. Admin and cron paths are tested with mocks/in-memory repositories in the session, then verified live after deploy.
- Outbound network may be restricted: `scripts/verify-production` exits **2 (UNVERIFIED)** when it can't reach a URL; report that as unverified, never as up or down.
- Sessions can't create repos or merge to `main`; they push their branch and open a PR.
- Preinstalled Chromium: `E2E_CHROMIUM_PATH=/opt/pw-browsers/chromium`; Postgres 16 binaries for `db:local-check`.

## 7. Deploy flow [U]
1. PR → CI green → preview URL verified (`scripts/verify-production <preview> --www skip`) → Bill merges.
2. Release owner runs `scripts/release preflight` on `main` ([RELEASE_STANDARD.md](RELEASE_STANDARD.md)).
3. Pending migrations: `scripts/release migrate --project-ref REF --confirm-production REF` **before** the deploy that needs them (migrations must be backward compatible with the running code).
4. Vercel builds `main` to production.
5. `scripts/release verify --url https://<domain>`; then the core journey on a phone.

## 8. Rollback [U]
| What broke | Do |
| --- | --- |
| App code | Vercel → Deployments → previous good deployment → Promote to Production (instant). Then fix forward on a branch |
| Migration | Never "down" migrate production by hand. Write a new forward migration that repairs; ship through the release gate |
| Config/env | Fix the variable in Vercel, redeploy (env changes need a new deployment) |
| Cron | Unset or change the Vault secret to stop calls; jobs no-op without it |

## 8b. Webhooks and previews [U] (simulation 2)
Preview URLs change per PR, so providers (Stripe, Meta) can't call them.
| Environment | Webhook target | How to test |
| --- | --- | --- |
| Development | `stripe listen --forward-to localhost:3000/api/stripe/webhook`; Meta: a tunnel only when needed | Provider CLI / test events |
| Preview (QA) | A **stable staging alias** (a `staging` branch with its own Vercel domain) registered once per provider, with test-mode keys | Merge the PR into `staging` to QA webhooks |
| Production | The production domain, live keys, separate signing secret | One live test after release (`checklists/production.md`) |
Each environment has its own signing secret; a webhook secret is never shared between environments.

## 9. Supabase per environment [P]
- Auth: Site URL and redirect URLs per environment (prod = production domain; dev includes `http://localhost:3000` and preview patterns).
- SMTP: production uses the company domain SMTP before staff are invited ([INTEGRATIONS_STANDARD.md](INTEGRATIONS_STANDARD.md)).
- Vault secrets (`<app>_app_url`, `<app>_cron_secret`) set per project; check `net._http_response` after the first tick.
- Backups: Supabase daily backups on paid plans; before risky migrations take a manual backup/branch.
