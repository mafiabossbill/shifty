# The way Bill makes apps

Engineering doctrine for every product Bill ships. Written so a senior team can follow it without talking to Bill.
Distilled from apps Bill has shipped to production and from Bill's standards.
Detailed rules live in the `docs/*_STANDARD.md` files linked from each section.

**Legend** (every rule carries one):

| Tag | Meaning | Deviation |
| --- | --- | --- |
| **[U] Universal** | Always. A product that breaks it is not done. | Only with Bill's explicit approval, recorded in `factory/DECISIONS.md`. |
| **[P] Preferred default** | What we do unless the product gives a reason. | Allowed: write a decision entry (context, choice, cost). |
| **[S] Product-specific** | A pattern that served one product. | Use only when the new product has the same need. |

---

## 1. Product philosophy
- [U] Build the **useful core first**: the one loop users repeat daily, end to end, on real data. Breadth later.
- [U] A real application, not a demo: real auth, real database, real permissions, real deployment. Dummy data is never "complete".
- [U] Infrastructure, mobile, deployment and production verification are part of "done", not phase 2.
- [U] Users understand it without training: plain words, one obvious way to do each thing, errors that say what to do.
- [U] UI quality and reliability are features. Calm, fast, never loses work.
- [P] Encode the business's one or two **non-negotiable rules** in the database, not just the UI. [S] Example: "status never changes without a progress note" (a SQL function + guard trigger).
- [P] Opinionated defaults over settings. Add a setting only when two real users need different behaviour.

## 2. Product discovery
- [U] Start from Bill's brief; never block on a perfect one. Missing information becomes **recorded assumptions** in the brief.
- [U] Ask Bill only when the answer changes product behaviour, architecture, security, money or irreversible infrastructure. Batch questions; one message.
- [P] Discovery output in one sitting: users and roles, the core loop, entities, the one rule, integrations, what "live" means (domain, data, people).
- [P] Prefer a running slice over a document: after the blueprint, the next artefact is a deployed preview.
- Templates: [intake/PRODUCT_BRIEF_TEMPLATE.md](intake/PRODUCT_BRIEF_TEMPLATE.md), [intake/PRODUCT_BLUEPRINT_TEMPLATE.md](intake/PRODUCT_BLUEPRINT_TEMPLATE.md).

## 3. PRD structure (`PRODUCT.md`)
[U] Every app repo has `PRODUCT.md` as product truth, updated by every PR that changes behaviour. Sections:

| Section | Content |
| --- | --- |
| One sentence | Who uses it, to do what, instead of what |
| Users and roles | Role → can → home page |
| Core rules | The few rules that must never break (enforced in DB) |
| Entities | Key fields, owner, lifecycle |
| Flows | The core loop and secondary flows, step by step |
| Integrations | Provider, direction, credentials needed, mock mode |
| Non-functional | Locale, currency, timezone, data volume, offline needs |
| Out of scope | Explicit "not now" list |
| Assumptions | From intake, each marked confirmed / replaced |

Full template: [intake/PRODUCT_REQUIREMENTS_TEMPLATE.md](intake/PRODUCT_REQUIREMENTS_TEMPLATE.md).

## 4. Default stack
Versions verified 2026-10-22; the template pins them.

| Layer | DEFAULT [P] | ALTERNATIVE | WHEN TO DEVIATE |
| --- | --- | --- | --- |
| Framework | Next.js **16.4** App Router, React 19.3, TypeScript strict | Remix/React Router; Astro for content | Marketing-only site → Astro or static Next export |
| Rendering | **Cache Components** on; session reads behind `<Suspense>` | Plain dynamic rendering | Very simple internal tool with no static shell needs |
| Package manager | **npm** with committed `package-lock.json` | pnpm | Monorepo with several packages |
| Styling | **Tailwind v4** (`@tailwindcss/turbopack`), CSS-variable tokens | CSS modules | Never mix two systems in one app |
| Components | shadcn pattern on the **`radix-ui`** package, `lucide-react`, `sonner`, `cmdk` | Base UI | A design system mandated by a client |
| Tables | Plain table for simple lists; **TanStack Table v9** + `@tanstack/react-virtual` for sortable/filterable/virtualized grids | AG Grid | Spreadsheet-grade editing at 100k+ rows |
| Validation | **Zod 4** at every boundary | Valibot | — |
| Database/Auth/Storage | **Supabase** (Postgres, Auth, RLS, Storage, Realtime), `@supabase/ssr` 0.12 | Neon + Auth.js; Firebase only for prototypes | Data residency or on-prem requirement |
| Scheduling | **Supabase pg_cron + pg_net + Vault** calling a `CRON_SECRET` route | Vercel Cron (Pro) ; Inngest/Trigger.dev | Long-running or fan-out workflows → a queue |
| Hosting | **Vercel** (one region next to the database) | Fly.io, Render | Long-lived connections, websockets servers, heavy CPU |
| Unit tests | **Vitest 5** (node env, `server-only` stubbed) | Jest | — |
| E2E | **Playwright** (desktop + 375 + 430) | — | — |
| PDFs | **@react-pdf/renderer** with embedded fonts | Headless Chrome | Pixel-perfect HTML reproduction |
| Payments | **Stripe** (Checkout + Billing + webhooks) | Paddle (merchant of record) | Mobile money markets → local PSP |
| Email | **Resend** or company SMTP via Supabase Auth SMTP | Postmark | — |
| Messaging | **WhatsApp Cloud API** direct | Twilio | Multi-channel SMS needs |
| Push | **Web Push (VAPID, `web-push`)** | OneSignal | Native apps |
| Charts | **Recharts**, only when a trend matters | Plain tables and KPI tiles | Heavy analytics → a BI tool, not custom charts |
| Errors | Structured logs + `/api/health` | **Sentry** when warranted | Paying customers, >1 dev, or errors you can't reproduce |

Details: [docs/ARCHITECTURE_STANDARD.md](docs/ARCHITECTURE_STANDARD.md).

## 5. Architecture philosophy
- [U] **Modular monolith**: one deployable app, one database. No microservices.
- [U] Separation, each in its own place:

| Concern | Lives in | Rule |
| --- | --- | --- |
| UI | `src/app/**` pages, `src/components/**` | No data access except through the typed API client or server loaders |
| Business logic | `src/lib/<domain>/*.ts` pure functions | Takes `now`/`today` as parameters; unit-tested |
| Data access | `src/lib/data/*` repositories behind an interface | Runs as the user (RLS); in-memory twin for tests |
| Integrations | `src/lib/<provider>/` behind an interface | Disabled / mock / live modes |
| Authorization | `src/lib/permissions.ts` + SQL `has_capability()` | One map, mirrored and tested |
| Validation | `src/lib/validation.ts` (Zod) | Every request body, every external payload |

- [U] Request pipeline in every route: `apiSession()` → parse → authorize → repository → `{ data }` / `{ error }`.
- [P] Route handlers for data APIs (consumed by a typed client); server actions for simple forms (auth).
- [P] Side effects (notifications, emails) after the response (`after()`), never failing the request.
- [U] Avoid: needless dependencies, abstractions with one implementation "for later", files over ~800 lines, hidden config.
- [P] Build behind an interface first when the backend is not ready (an in-memory repository is enough for phase 1), then swap.

## 6. Repository structure
[P] One repo per product, from `templates/nextjs-supabase`:
```
PRODUCT.md  CLAUDE.md  AGENTS.md  README.md  .env.example  .factory.json
factory/        STATE, TASK_GRAPH, OWNERSHIP, DECISIONS, HANDOFFS, RELEASES (shared memory)
src/app/        (auth) (legal) (app) api/ — routes and pages
src/components/ ui/ shell/ <feature>/
src/lib/        permissions, validation, data/, supabase/, <domain>/, <provider>/
supabase/       migrations/ (numbered ranges)  local/ (stub for local checks)  optional/
scripts/        migrate, sql, check-rls, db-local-check, configure, generate-icons, stop-gate
tests/  e2e/  public/  .github/  .claude/
```

## 7. Database philosophy
Details: [docs/DATABASE_STANDARD.md](docs/DATABASE_STANDARD.md).
- [U] Every schema change is a migration file. **Never** edit production by hand. Never edit an applied migration.
- [U] Foreign keys everywhere; tenant children use composite `(organization_id, id)` FKs so rows can't cross tenants.
- [U] `created_at`/`updated_at timestamptz not null default now()` + `set_updated_at` trigger.
- [U] CHECK constraints for invariants (status ⇒ required fields, ranges, formats). Enums for closed sets.
- [U] Indexes for every list query and every FK used in joins; partial indexes for "open" subsets.
- [U] RLS enabled on every table in the same migration that creates it.
- [P] Soft delete policy: **deactivate people, archive referenced entities, hard-delete leaf content**; audit log keeps history either way.
- [P] Audit policy: triggers write `audit_logs` (actor, entity, action, changed columns) for every business table.
- [P] Naming: snake_case, plural tables, `<table>_<cols>_idx`, functions as verbs (`record_progress_update`).
- [U] Multi-row rules as Postgres functions in one transaction.

## 8. Supabase standard
Details: [docs/SUPABASE_STANDARD.md](docs/SUPABASE_STANDARD.md).

| Topic | Rule |
| --- | --- |
| Clients [U] | Server client per request (cookies, RLS); browser client singleton (storage/realtime only); **service-role client only in cron/webhooks/auth-admin**, server-only, scoped by org in code |
| Session [U] | `getClaims()` on the server (verified JWT), never `getSession()`; proxy refreshes cookies |
| RLS [U] | Policies call `has_capability()`; reads use `organization_id in (select my_organization_ids())` (initplan, fast) |
| Storage [P] | Private buckets, path `<org_id>/<entity_id>/<uuid>-<name>`, storage policies parse the path; size and MIME limits on the bucket |
| Realtime [P] | `postgres_changes` filtered by org, RLS applies; UI revalidates in the background, no reloads |
| Vault + pg_cron [P] | URLs/secrets in Vault; jobs no-op until configured; verify `net._http_response`, not "Succeeded" |
| Environments [U] | Separate dev and prod projects; preview uses dev unless data isolation requires a staging project |
| Migrations [P] | Management-API runner (HTTPS, works in cloud sessions) + local Postgres check |

## 9. Authentication
Details: [docs/SECURITY_STANDARD.md](docs/SECURITY_STANDARD.md).

| Flow | Standard |
| --- | --- |
| Sign up [P] | Email + password; account gets access only via invite claim or admin add |
| Log in / out [U] | Server action sign-in; sign-out revokes the session and clears cookies |
| Password reset [U] | **Implicit flow** link that works on any device; same answer whether the account exists |
| Invites [P] | Admin records invite; person signs up; `claim_invite()` on confirmed email |
| Admin-created accounts [P] | Service-role create + one SQL function for profile/membership/audit; delete the auth user if the second step fails; placeholder emails for people who never log in; temporary password forces change |
| First admin [U] | `ADMIN_EMAIL` in a private settings table; first **confirmed** sign-in claims Admin. No hardcoded credentials |
| Verification [U] | Email confirmation on; custom **SMTP on the company domain** before inviting staff (Supabase's mailer only reaches project members) |
| Session refresh [U] | Proxy on every request; Auth hiccup → retry once, then let pages check themselves |
| Deactivation [U] | Deactivate, never delete members; every helper ignores deactivated members; last-admin guard |
| Redirect URLs [U] | Supabase Auth Site URL and redirect list follow the production domain |

## 10. Authorization
- [U] One capability map (`src/lib/permissions.ts`): roles → capabilities; code asks `can(user, "x:y")`, never `role === "admin"`.
- [U] Every server path checks; **RLS mirrors the same map** (`private.role_capabilities()` + `has_capability()`); a unit test fails if they drift.
- [U] Frontend gets derived booleans to hide controls; hiding is UX, not security.
- [U] Live RLS proof (`npm run db:check-rls`) after every policy change and in every release.
- [S] Example roles: Admin, Department Head, Team Member, Executive (stored `viewer`, read-only + reports).

## 11. Multi-tenancy
- [P] Organization-scoped from day one even for a single company (one org is fine; isolation is still proven).
- [U] Every tenant row has `organization_id`; every query filters by it; RLS enforces it; check-rls proves an outsider sees nothing.
- [P] Two tenancy variants, chosen in the blueprint:
  | Variant | Who creates organizations | Joining | Template support |
  | --- | --- | --- | --- |
  | **Company** (default) | `npm run db:configure` creates one | Invites + admin bootstrap | Built in |
  | **SaaS** (self-serve) | Each signed-up person via `create_organization()` | Invites per workspace | `scripts/bootstrap --saas` (or `"tenancy": "saas"`): migration `0003_workspaces.sql`, `/onboarding`, `POST /api/workspaces`, RLS-proven (max 5 per person, confirmed email) |
- [P] People in several organizations switch from the workspace switcher in the sidebar (`active_org` cookie, `POST /api/session/organization`).
- [S] Per-org settings: timezone, currency, week start, code prefix.

## 12. API conventions
- [U] JSON in/out; success `{ data }` (lists: `{ data, total, next_cursor }`); errors `{ error: "Human sentence." }`.
- [U] Status codes: 400 validation, 401 signed out, 403 not allowed, 404 not found / not visible, 409 conflict/rule, 503 not configured (with what to set).
- [U] Unknown fields rejected on PATCH (`.strict()`); locked fields refused explicitly.
- [P] Paging with keyset cursors bound to the query; server applies what it can, client filters the rest.
- [U] Webhooks verify signatures on the raw body before parsing; idempotency key per event.
- [U] Retryable creates take a client `client_id`: a repeat returns the original (200), a conflict with newer state is 409, validation 400 (architecture standard §11b).
- [U] Cron routes require `Authorization: Bearer CRON_SECRET` (constant-time) and are idempotent per period.

## 13. Responsive and mobile UX
Details: [docs/UI_UX_STANDARD.md](docs/UI_UX_STANDARD.md), checklist [checklists/responsive.md](checklists/responsive.md).
- [U] Never desktop-shrunk. Review at **375, 390, 430, tablet (768/1024), desktop (1280+)**, light and dark.
- [U] Phones: bottom navigation (≤4 tabs + More), dense tables become cards (wide grids may scroll sideways inside their own box), dialogs become bottom sheets, drawers full-width.
- [U] Touch targets ≥44×44px; inputs ≥16px (no iOS zoom); safe areas on bars, sheets and toasts; no page-level sideways scroll; sticky headers/footers clear the keyboard.
- [P] Phone type scale one step larger than desktop's dense 13px.

## 14. PWA requirements
Details: [docs/PWA_STANDARD.md](docs/PWA_STANDARD.md).
- [U] Decide per product (PWA on for field/mobile/daily-use apps; off for marketing sites). Record the decision.
- [U] When on: full manifest (relative URLs, any + maskable 192/512, apple-touch), HTTPS, `viewport-fit=cover`, safe areas.
- [U] Service worker caches **static shell/offline page only** — never API responses, authenticated pages, other origins or mutations.
- [U] Only claim offline what is built and tested; say "needs a connection" otherwise.
- [U] Safe updates: `/sw.js` served `no-cache`, versioned caches, old ones deleted on activate.
- [U] Test on iPhone (installed), Android, tablet, desktop. iOS push only works installed (16.4+).

## 15. UI/UX system
Details: [docs/UI_UX_STANDARD.md](docs/UI_UX_STANDARD.md). Influences (principles, not cloning): **Attio, Linear, Airtable**; Monday/Productive/Smartsheet only for specific patterns (boards, resource views, Gantt).

| Principle | Concretely |
| --- | --- |
| Near-white surfaces, subtle borders | `--background` white, `--border` oklch 0.925; sidebar a hair warmer |
| Restrained accent, color only for meaning | Neutral UI; color for status, danger, success, links in prose |
| Semantic status pills | Tinted background + dot + label; same tone map everywhere |
| Compact controls | 32px controls desktop (40px phones); 13px body; `sm`/`xs` in toolbars and rows |
| Tables over cards (desktop) | Dense rows, sticky header, column chooser, saved views |
| Side drawers for detail | Open records in a right sheet; list keeps its place |
| Inline editing where safe | Fields save in place; destructive edits confirm |
| Command palette | ⌘K search + actions; keyboard shortcuts sheet |
| Skeletons, not spinners | Same-size frames while loading |
| Human errors | Sentence + what to do; failures persist where users can find them |
| Minimal empty states | One sentence, one action, no illustrations |
| Type | Geist (or Inter), modest scale (13/15/20), weight not size for hierarchy |
| Information over decoration | Charts only when a trend matters; numbers link to the rows behind them |

## 16. Preferred shells and table UX
- [P] **App shell**: sidebar 224–240px (md+) · top bar 50px with page title and user · phone bottom bar · content scrolls inside `main`.
- [P] **Settings shell**: grouped side nav ≥1024px; below that a menu page and back links.
- [P] **Auth shell**: one centered column, brand mark, one form; legal links reachable signed out.
- [P] **Table UX**: search + quick filters in URL; saved views (private/team/org); column show/hide/reorder/resize; sort; group; bulk select with safe bulk edits; CSV export of visible columns; virtualized rows past ~200; row opens drawer; Enter/arrows/Esc work.

## 17. Common product features library
| Feature | When appropriate | Notes |
| --- | --- | --- |
| Auth (email+password) | Always [U] | Template |
| Organizations + roles | Any multi-user product [P] | Template capability map |
| Settings (profile, org) | Always; org settings when admins exist | `/settings/*` |
| Tables + saved views | Any list users work from daily | The main work table |
| Drawers | Records with >5 fields or activity | Row opens a side drawer |
| Dashboards | Only with decisions attached to each number | One overview per role |
| Activity / audit log | Business records, money, approvals [P] | `audit_logs` triggers |
| Comments + mentions | Collaborative records | `<@uuid>` tokens + notifications |
| Notifications (in-app) | Any assignment/mention/approval | Bell + realtime |
| Statuses | Workflow entities; semantic tones | Status pills |
| Ownership + deadlines | Work tracking | owner, deadline, overdue logic |
| Attachments / file storage | Evidence, receipts, photos | Private bucket, org path |
| Approvals | Money, risk, compliance | Request/decide functions, no self-approval |
| Costs / money | Budgets, spend, payments | Integer minor units + currency; `src/lib/money.ts` (`formatMinor`, `toMinor`); never convert stored values |
| Import / export (CSV) | Onboarding existing data; reporting to Excel users | Preview with per-row errors; formula-injection neutralized |
| Reporting | Managers need periodic summaries | Pure engine + stored snapshots |
| Scheduled reports | People who won't log in daily | pg_cron + idempotent per period |
| Webhooks (inbound) | Any provider callbacks | Signature + event ledger |
| Realtime | Shared lists edited by several people | Supabase realtime + revalidate |
| Search + command palette | >100 records or power users | Postgres FTS + trigram |
| Analytics (product) | After launch, when questions exist | Vercel Analytics first |
| Cron | Reminders, sweeps, reports | Vault-configured, ledger-claimed |
| Email | Auth (always via SMTP), digests if users live in email | Company domain |
| WhatsApp | Markets where staff live in WhatsApp (East Africa) [S] | Templates, 24h window, opt-in |
| Push | Time-sensitive alerts, installed PWAs | VAPID, preferences per type |
| PWA | Mobile/daily/field use | §14 |
| PDFs | Reports people forward or print | @react-pdf, embedded fonts, light only |
| Go-live readiness / feedback register | Company rollouts with testers [S] | `/go-live`, `/feedback` pages |
| Photos (field capture) | Evidence from phones: inspections, damage reports | Compress in browser, org-scoped private bucket, signed URLs, queue offline |
| Signatures | Client/officer sign-off on a record | Signature image + signer + time + payload hash; record immutable after signing; SENSITIVE_DATA |
| Plans and billing | We charge customers (BILLING) | Stripe Billing, webhook-driven state, writes gated by `workspace_active()` |
| Provider data sync | We read customers' data (PROVIDER_DATA) | OAuth read scopes, backfill + webhooks + reconcile, tokens service-role only |
| Offline queue | Work without network, sync later (OFFLINE) | `src/lib/offline/outbox.ts`, `sw-offline.js`, `client_id` replays, PWA standard §11b |

## 18. Reusable infrastructure
[P] From the template, never rewritten per app: proxy + public paths · session helpers · capability map + SQL mirror · Zod pipeline · repository pattern · migration runner (duplicate-safe) · local + live RLS checks · structured logger · cron auth · health endpoint · confirm dialog · status pill · skeleton/empty state · tokens light/dark · PWA kit · icon generator · stop-gate hook · CI workflow · `scripts/verify-production` · `scripts/release`.

## 19. Third-party integrations
Details: [docs/INTEGRATIONS_STANDARD.md](docs/INTEGRATIONS_STANDARD.md).
- [U] Every integration ships behind a flag with **disabled / mock / live** modes; the app works with it off.
- [U] Never claim an integration works without live credentials and a recorded live test. Mock success is labelled mock.
- [U] Credentials go in Vercel / cloud environment settings, never in chat or code. A pasted secret is exposed: rotate it.
- [U] Stop only at real credential boundaries and say exactly which variable, where it goes, and what it unlocks.

## 20. Reliability
- [U] Idempotency for every job and webhook (unique ledger keys; partial unique indexes per period).
- [U] Overlapping cron ticks are safe; missed windows are skipped or caught up deliberately, never doubled.
- [U] Failures are visible: structured logs, job status commands, health endpoint, UI that keeps errors until dismissed.
- [P] Retries at the edge only (transport); business operations are not blindly retried.
- [U] Optimistic UI must roll back and tell the user.

## 21. Testing pyramid
Details: [docs/TESTING_STANDARD.md](docs/TESTING_STANDARD.md).

| Layer | What | Gate |
| --- | --- | --- |
| Unit [U] | Pure rules, parsers, permissions, validation, schedules | Every commit (Stop hook) |
| Route [U] | Handlers with an in-memory repository: auth, validation, permission paths | Every commit |
| Static [U] | Capability map ↔ SQL, env vars documented, migrations unique + RLS on | Every commit |
| DB [U] | Migrations + RLS on local Postgres; live RLS on the real project | Every PR (CI) / every release |
| E2E smoke [U] | Public pages, auth redirect, manifest, health at 3 widths | Every preview + production |
| E2E journeys [P] | The core loop signed in | Before release |
| Visual sweep [P] | Overflow, targets, input size at all widths, both themes | UI waves |
- [U] QA is independent of the builders. A builder's "it works" is not evidence.

## 22. Security
Details: [docs/SECURITY_STANDARD.md](docs/SECURITY_STANDARD.md).
- [U] No frontend-only security. Server checks + RLS for every read and write.
- [U] Security review is **mandatory** when a change touches: auth, payments, sensitive data, uploads, multi-tenancy, public APIs, webhooks, admin features, financial data.
- [U] Secrets never in repos, logs, chat, URLs or `NEXT_PUBLIC_*`. Service role only server-side.
- [U] Signed links expire; `?next=` only same-site; CSV export neutralizes formulas; uploads limited by size and MIME at the bucket.

## 23. Observability
- [U] Proportional: structured one-line JSON logs (ids and counts, no PII), `/api/health`, failed-job visibility (status command or admin page).
- [P] Sentry when the product has paying users, several developers, or errors you can't reproduce.
- [U] Vercel Hobby keeps runtime logs ~1 hour: test, then read logs immediately; confirm conclusions with a second source.

## 24. Git workflow
- [U] `main` is always deployable. Branches `feature/*`, `fix/*`, `infra/*` (cloud sessions use their assigned `claude/*` branch).
- [U] Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`), small and coherent; task → implement → test → commit → handoff.
- [U] No force-push on shared branches. Never rewrite someone else's history. Merge, don't rebase, shared branches.
- [U] One PR per session/task with the handoff in the body. **Bill merges.** Agents never merge to `main`.

## 25. Claude Code workflow
Details: [docs/AGENT_SYSTEM.md](docs/AGENT_SYSTEM.md).
- [U] Work happens in **Claude Code cloud sessions** (claude.ai/code). The orchestrator session plans and starts one session per phase/bucket; each works on its own branch and opens a PR.
- [U] Cloud sessions can't message back: the orchestrator verifies through GitHub (branches, PR bodies, checks) and Vercel (build status, logs), never by assumption.
- [U] Execute, don't plan back to Bill. Replies are short, plain, honest: what was done, what was verified, what's blocked.
- [U] Never claim done/deployed/working without the verifying command and its output.
- [P] Project `CLAUDE.md` + `.claude/agents/*` + `.claude/skills/*` + a Stop hook running `npm run check` ship in every app.

## 26. Multi-agent workflow
- [U] The orchestrator selects the **minimum useful team** ([factory/AGENT_ROUTER.md](factory/AGENT_ROUTER.md)), writes the task graph, assigns ownership, and does not code everything itself.
- [U] Parallel work is split by **file ownership** with explicit "you own / do not edit" lists ([factory/OWNERSHIP.md](factory/OWNERSHIP.md)).
- [U] **Every writer of migrations gets a number range.** (Two sessions once both wrote 0080 because one had no range.)
- [U] Shared foundations land first (schema core, shell, shared primitives like the confirm dialog). Cross-cutting passes (dark mode, mobile pass) run after the waves they touch.
- [P] An integration session merges conflicting PRs when lanes collide.
- [U] Handoffs in the fixed format ([factory/HANDOFFS.md](factory/HANDOFFS.md)); shared memory in `factory/STATE.md`.
- [U] Single release owner (release-engineer). Database engineer owns migrations. QA independent of builders. DevOps verifies production URLs before claiming success.

## 27. CI/CD
- [U] GitHub Actions on every PR: lint, typecheck, unit tests, build, migrations + RLS on local Postgres ([templates/github/workflows/ci.yml](templates/github/workflows/ci.yml)).
- [U] Vercel builds every PR as a preview; smoke tests run against it on `deployment_status`.
- [U] Production deploys from `main` only, after the release gate.

## 28. Vercel preview and production
Details: [docs/DEPLOYMENT_STANDARD.md](docs/DEPLOYMENT_STANDARD.md).
- [U] Three environments: development (local, dev Supabase), preview (per PR), production.
- [U] Env vars set per environment; production values never reused in preview unless deliberate.
- [P] Region next to the Supabase project (e.g. `dub1` for an EU project).
- [U] Hobby limits are real: cron daily-only, ~1h logs, function duration caps (`maxDuration` for PDF work).

## 29. Custom domains, DNS, SSL
Details: [docs/DOMAIN_STANDARD.md](docs/DOMAIN_STANDARD.md).
[U] Order: domain → Vercel project domain → DNS provider records (A/ALIAS apex, CNAME www) → apex/www decision → canonical + redirects → propagation → SSL issued → HTTPS everywhere → `NEXT_PUBLIC_SITE_URL` → Supabase Auth Site URL + redirects → OAuth callbacks → webhooks (WhatsApp, Stripe) → CORS → email links/SMTP domain → robots → `scripts/verify-production`.
- [U] Never hardcode a hostname until the domain is final; manifest `start_url` stays relative forever.

## 30. Environment variables
- [U] Every variable lives in `.env.example` with a class tag: `[public]` (NEXT_PUBLIC_, browser), `[server]` (server, not secret), `[secret]` (server secret), `[scripts]` (local/CI only), plus `(required)`/`(optional)`.
- [U] Environment-specific values (dev/preview/prod) set in Vercel per environment; `scripts/env-check` validates and scans for leaks.
- [U] A test fails if code reads an undocumented variable (no hidden config).

## 31. Migrations
- [U] Numbered `NNNN_name.sql`, ranges per owner, append-only, reviewed before production, applied by the release owner through `scripts/release migrate` (project ref confirmed twice).
- [U] The runner refuses duplicate versions and unknown applied versions.
- [U] Destructive changes (drop/rename/type change) go in two releases: add + backfill + switch, then remove.
- [U] Before the first release, template migrations may still change (remove the example entity with `scripts/bootstrap --no-example`); after it, `release verify` tags the baseline and shipped migrations are frozen.

## 32. Releases
Details: [docs/RELEASE_STANDARD.md](docs/RELEASE_STANDARD.md).
- [U] `scripts/release preflight` gates: git clean/pushed → check (lint, typecheck, tests, build, local DB+RLS) → env → migrations reviewed → preview verified → manual phone/desktop review. It stops at the first failure.
- [U] Then migrate (if needed) → merge/deploy → `scripts/release verify`. Rollback = promote previous Vercel deployment; DB is fix-forward.

## 33. Post-deployment verification
- [U] `scripts/verify-production <url>`: HTTPS + certificate, http→https, www behaviour, health, manifest, service worker headers, public pages, protected redirects, security headers.
- [U] "Unverified" (can't reach from here) is reported as unverified — never as up or down.
- [U] Then the core journey by hand on a phone, and integrations with a live test (one real WhatsApp message, one real payment in test mode…).

## 34. Documentation
- [U] `README.md` (setup, commands, layout), `PRODUCT.md` (truth), `factory/DECISIONS.md` (why), `.env.example` (config), `CLAUDE.md` (agent rules).
- [P] Docs change in the same PR as the behaviour. No wiki elsewhere.

## 35. Maintenance
- [P] Dependabot weekly (grouped minor/patch); upgrade Next/Supabase deliberately with the Next docs in `node_modules/next/dist/docs/`.
- [P] Monthly: rotate long-lived tokens that can be rotated, review Supabase advisors (RLS/perf), check cron HTTP responses, prune old notifications/logs.

## 36. Feature development
[U] Workflow [workflows/new-feature.md](workflows/new-feature.md): request ([intake/FEATURE_REQUEST_TEMPLATE.md](intake/FEATURE_REQUEST_TEMPLATE.md)) → assumptions → blueprint delta → migration (range) → permissions both layers → API + tests → UI (all widths, both themes) → QA → PR with handoff → preview verified.

## 37. Bug fixing
[U] Workflow [workflows/bug-fix.md](workflows/bug-fix.md): reproduce first (test or script) → root cause (not "flake") → smallest fix → regression test → verify on preview (and production if it was there).

## 38. Quality gates / Definition of Done
A change is **done** only when all are true [U]:
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` PASS
- [ ] Migrations (if any) in range, reviewed, local DB + RLS check PASS
- [ ] Permissions changed in both layers (or untouched)
- [ ] Checked at 375/430/tablet/desktop in light and dark (UI changes)
- [ ] Preview deployment verified by hand
- [ ] Production deployed, `scripts/verify-production` PASS, smoke test done, domain verified (for releases)
- [ ] Handoff written; `PRODUCT.md`/docs updated

## 39. What Bill dislikes
Rainbow UI · big gradients · cards everywhere · heavy rounding and shadows · huge type · gimmicky animation · the generic AI-SaaS look · decorative dashboards and purposeless charts · Excel ugliness · old enterprise look · wordy replies · plans instead of execution · questions that a sensible default answers · "done" without proof · hidden errors · demos sold as products.

## 40. What Bill repeatedly asks to improve
- Speed: no reloads, background refresh, instant sign-out, prefetching (staleTimes, optimistic cache).
- Phone experience: bottom bar, bigger phone type, button grids for role homes, sheets.
- Consistency: one button system, one confirm dialog, same pills everywhere ("UI consistency" bucket).
- Role-appropriate homes: executives read-only summary, employees "My Work", managers overview.
- Errors that don't disappear (Problems list in the bell).
- Every field required where the business needs it (New Task required fields).
- Login and first impression (logo, warm welcome).
- Reports people actually read (WhatsApp summaries, PDFs).

## 41. Anti-patterns (refuse these)
Fake prototypes · dummy data called complete · skipping mobile · hardcoded secrets · manual production DB edits · colourful UI · gradients · cards everywhere · purposeless charts · hidden errors · assuming deploys work · claiming integrations work without credentials · frontend-only auth · duplicated logic (UI and API disagreeing) · five ways to do one action · over-engineering early · unmigrated schema changes · undocumented deploy steps · giant files · needless dependencies · microservices.

## 42. Launch checklist
Full list: [checklists/production.md](checklists/production.md). Highlights [U]:
- [ ] Go-live data pack collected ([intake/GO_LIVE_DATA_PACK_TEMPLATE.md](intake/GO_LIVE_DATA_PACK_TEMPLATE.md)): departments/teams, people with roles and contacts, current work in import format, workflow decisions, reporting schedule, domain and email
- [ ] Demo and test data removed; test accounts deleted or clearly marked
- [ ] SMTP on the company domain; Auth Site URL/redirects on the production domain
- [ ] First admin via `ADMIN_EMAIL`; people added (invite or admin-created)
- [ ] Legal details filled (`npm run legal:check` PASS): privacy, terms, cookies, data deletion public — required by law and for Meta/Google review
- [ ] Cron configured (Vault) and **HTTP responses checked**
- [ ] Integrations live-tested with real credentials
- [ ] `scripts/release verify` PASS on the domain; phone install tested
- [ ] Bill told in plain words: what is live, the URL, what is not yet, what is needed from him

## 43. Locale and currency [P]
- Per company defaults in `app-config.ts` and per org: currency, timezone, week start, locale. [S] Tanzania: **TZS, no decimals (`TSh 1,250,000`), Africa/Dar_es_Salaam**.
- [U] Never silently convert or relabel stored amounts; a row in another currency shows its code.
- [U] "Today" and deadlines use the business timezone, not the viewer's browser.
- [U] Money is stored as integer minor units + currency and shown only through `src/lib/money.ts` (TZS shows `TSh 1,250,000`; typed amounts parse exactly or are refused).

## 44. Legal and user data [U]
Every app ships these from day one (template), filled before launch; `scripts/release` refuses a release with placeholders.
| Item | Where | Notes |
| --- | --- | --- |
| Privacy policy | `/privacy` | Controller, data collected, purposes + legal bases, processors table, transfers, retention, security, rights, regulator, children, changes |
| Terms of service | `/terms` | Accounts, acceptable use, content ownership, availability, fees, suspension, liability cap, governing law |
| Cookie notice | `/cookies` | Strictly necessary only (no banner). Analytics/ads need a consent banner and an update first |
| Data deletion instructions | `/data-deletion` | In-app steps + email route; what is deleted and what stays anonymized |
| Download my data | Settings → Your data (`GET /api/account/export`) | JSON of account, consent record, workspaces and records they created; extend per entity |
| Delete my account | Settings → Your data (`delete_own_account()`) | Type email to confirm; blocked while last admin of a shared workspace; solo workspaces go too; history kept without their name |
| Consent record | Sign-up | Terms version + timestamp stored on the account; shown in the export |
| One source | `src/lib/legal.ts` | Operator, address, contact, jurisdiction, regulator, effective date, processors, retention days (from the go-live data pack) |
- [U] Each new integration adds its processor row; each new personal-data entity joins the export; a lawyer reads the pages once per product.
