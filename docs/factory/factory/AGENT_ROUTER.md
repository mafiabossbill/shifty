# AGENT ROUTER

How the orchestrator picks the **minimum useful team**. Detect capabilities from the blueprint
(`capabilities` in `factory/blueprint.json`), add agents only when a capability triggers them, and record
both the agents chosen and the agents **not** chosen with a reason (in the app's `factory/STATE.md`).

## Base team (every app that ships)
| Agent | Why always |
| --- | --- |
| orchestrator | Plans, assigns, integrates, reports |
| product-architect | Blueprint + `PRODUCT.md` (the orchestrator may cover it for a 1–3 screen tool) |
| frontend-engineer | Any UI |
| backend-engineer | Any API or rule |
| qa-engineer | Independent verification (never the builder) |
| release-engineer | Single production owner (`PRODUCTION_RELEASE` is implied by "ship") |

## Capability → agent map
A capability's required agents must be chosen, or **covered** by a chosen agent (`team.chosen[].covers` in the
blueprint) when the job is small — e.g. devops-engineer covers supabase-engineer for one bucket and one cron job.
security-reviewer, qa-engineer and release-engineer can never be covered (independence). The validator
(`tools/validate-blueprints.mjs`) enforces this table and derives capabilities from blueprint content
(a `file`/`signature` field ⇒ FILE_UPLOADS, offline ≠ none ⇒ OFFLINE, a Stripe/Paddle provider ⇒ PAYMENTS or BILLING,
scheduled jobs ⇒ SCHEDULED_JOBS; >6 screens without UI_HEAVY is a warning).

<!-- router-table:start (generated from factory/router.json by tools/router-table.mjs; don't edit by hand) -->
| Capability | Triggers (blueprint fields, brief words) | Required agents | Notes |
| --- | --- | --- | --- |
| UI_HEAVY | >6 screens, tables/boards/calendars, dashboards, "Attio/Linear-like", role-specific homes | ux-architect | Lands shell + primitives before feature lanes |
| COMPLEX_DATA | >3 entities, relations, statuses with rules, approvals, history, money | database-engineer | Gets the first migration range |
| SUPABASE | Any persistence (template default) | database-engineer | Add supabase-engineer for storage, realtime, cron, SMTP or several environments (their own rows) |
| AUTH | Sign-in, invites, roles, admin-created accounts, SSO | supabase-engineer + security-reviewer | SMTP and Auth URL config are part of it; a small app may let devops-engineer or database-engineer cover supabase-engineer |
| MULTI_TENANT | Several organizations/customers in one deployment; self-serve workspaces | database-engineer + security-reviewer | check-rls outsider cases mandatory; workspace switcher; self-serve = bootstrap --saas |
| PAYMENTS | Money moves: checkout, invoices, payouts | integration-engineer + security-reviewer | Webhook-driven state; test mode first |
| BILLING | We charge our customers: plans, trials, subscriptions | integration-engineer + security-reviewer | Plan state gates writes (workspace_active); webhooks per environment |
| PROVIDER_DATA | We read customers' data from a provider (Stripe Connect, Google, banks) | integration-engineer + security-reviewer | Backfill + webhooks + reconcile; tokens never readable by authenticated |
| REALTIME | "live", see changes instantly, shared boards, chat | supabase-engineer | Realtime + background revalidate |
| PWA | "install", phone, field, daily use | pwa-mobile-engineer | Decide offline scope explicitly |
| MOBILE_HEAVY | Most users on phones, camera, GPS, one-handed use | pwa-mobile-engineer + ux-architect | Phone-first layouts, not a late pass |
| OFFLINE | "work offline", "sync later", bad network | pwa-mobile-engineer + backend-engineer + qa-engineer | Outbox + replayable writes (client_id) + offline test script; pwa.offline read-cache or offline-queue |
| FILE_UPLOADS | Photos, receipts, documents, attachments (any `file` field) | supabase-engineer + security-reviewer | Bucket limits, path policies, signed URLs, compress phone photos |
| THIRD_PARTY_API | Any external system (ERP, maps, banks) | integration-engineer | Disabled/mock/live modes |
| MESSAGING | WhatsApp, SMS, chat notifications | integration-engineer + security-reviewer | Template approval lead time: start early |
| EMAIL | Transactional email beyond auth, digests, documents by email | integration-engineer + supabase-engineer | Company-domain SPF/DKIM; src/lib/email modes |
| PUSH | "alerts", notify my phone | integration-engineer + pwa-mobile-engineer | VAPID per environment |
| SCHEDULED_JOBS | Reports, reminders, sweeps, "every day at" | supabase-engineer + backend-engineer | pg_cron + Vault (npm run db:cron); idempotent per period; schedule timezone explicit |
| REPORTING | Summaries, exports, printable docs | backend-engineer | Pure engine, stored snapshots; PDFs via integration-engineer when delivered |
| IMPORT_EXPORT | "migrate our spreadsheet", CSV | backend-engineer + frontend-engineer | Preview with per-row errors |
| ANALYTICS | Product analytics asked for | devops-engineer | Vercel Analytics first |
| CUSTOM_DOMAIN | A domain is named or implied | devops-engineer | docs/DOMAIN_STANDARD.md order |
| PRODUCTION_RELEASE | Anything going live (every app) | release-engineer | Base team |
| DOCS_HANDOVER | Company rollout, another team will operate it | documentation-engineer | Go-live pack |
| SENSITIVE_DATA | Health, HR, finance, personal IDs, children, signatures | security-reviewer | Retention + deletion page |
<!-- router-table:end -->

**Not chosen** rules: no ux-architect for ≤3 screens built from existing primitives; no supabase-engineer when only
plain tables exist (database-engineer covers it); no pwa-mobile-engineer when the decision is "PWA off" and users are on
desktop (the frontend responsive checklist still applies); no documentation-engineer for internal tools with one
operator (builders keep README current); security-reviewer is never optional when a trigger above fires.

## Example teams
| Product type | Capabilities | Team (beyond base) | Not chosen (why) |
| --- | --- | --- | --- |
| Marketing site | UI_HEAVY (light), CUSTOM_DOMAIN | ux-architect, devops-engineer | database/supabase (no data), qa light, security (no auth) — base trims backend-engineer if no forms |
| Internal CRUD SaaS (e.g. equipment tracker) | COMPLEX_DATA, AUTH, FILE_UPLOADS, CUSTOM_DOMAIN | database-engineer, supabase-engineer, security-reviewer, devops-engineer | ux-architect (template shell suffices), pwa-mobile (desktop-first), integration (none) |
| Realtime collaborative app | REALTIME, COMPLEX_DATA, AUTH, UI_HEAVY | ux-architect, database-engineer, supabase-engineer, security-reviewer, devops-engineer | pwa (unless mobile), integration (none) |
| Mobile-heavy PWA (field app) | PWA, MOBILE_HEAVY, FILE_UPLOADS, COMPLEX_DATA, AUTH | ux-architect, pwa-mobile-engineer, database-engineer, supabase-engineer, security-reviewer, devops-engineer | integration (unless maps/sync API), documentation (unless rollout) |
| Payments platform (subscription SaaS) | PAYMENTS, MULTI_TENANT, AUTH, EMAIL, SCHEDULED_JOBS, CUSTOM_DOMAIN | ux-architect, database-engineer, supabase-engineer, integration-engineer, security-reviewer, devops-engineer | pwa-mobile (desktop analytics), documentation (until launch) |
| Third-party integration (e.g. WhatsApp reporting bot) | MESSAGING, SCHEDULED_JOBS, THIRD_PARTY_API, REPORTING | integration-engineer, supabase-engineer, security-reviewer, devops-engineer | ux-architect (few screens), pwa-mobile (no app UI) |

## Parallelism rules
| Can run in parallel | Must be sequential |
| --- | --- |
| Feature lanes with disjoint file globs and their own migration ranges | Blueprint → data model core → shell/primitives → feature lanes |
| security-reviewer and qa-engineer on the same candidate | Migrations applied to production → deploy → verify |
| integration mock work while credentials are pending | Cross-cutting passes (mobile, dark mode) after the waves they touch |
| documentation during QA | Release after QA + security sign-off |
