# Security checklist

Mandatory review when a change touches: auth, payments, sensitive data, uploads, multi-tenancy, public APIs, webhooks, admin features, financial data. Standard: [../docs/SECURITY_STANDARD.md](../docs/SECURITY_STANDARD.md).

## Authorization
- [ ] Every new read and write checked on the server (`can()` / ownership) AND by RLS — not only hidden in the UI
- [ ] Capability map and SQL mirror agree (`tests/permissions.test.ts`)
- [ ] `npm run db:local-check` and `npm run db:check-rls` PASS, with the new table/policy covered
- [ ] Viewer/read-only roles can't mutate anything through the API (route test with that role → 403)
- [ ] Cross-tenant access impossible: composite FKs, org filter in code, outsider check in `check-rls.ts`

## Authentication
- [ ] Server uses `getClaims()` (verified JWT), never `getSession()`
- [ ] `?next=` and redirects only same-site (`safeNextPath`)
- [ ] Reset/confirmation responses don't reveal whether an account exists
- [ ] Deactivated users lose access (every helper filters `deactivated_at is null`)

## Secrets
- [ ] No secret in the repo, logs, URLs, chat or `NEXT_PUBLIC_*` (`scripts/env-check` leak scan PASS)
- [ ] Service-role key only in server code for cron/webhooks/auth-admin; never imported by a page or client component
- [ ] New secrets documented in `.env.example` as `[secret]`; values only in Vercel / cloud settings
- [ ] A secret that was pasted or committed is rotated, not just deleted

## Inputs and outputs
- [ ] Every body and external payload validated with Zod; PATCH `.strict()`
- [ ] Uploads: private bucket, path starts with the org id, size and MIME limits on the bucket, signed URLs short-lived
- [ ] CSV export neutralizes formula-like cells (`=`, `+`, `-`, `@`)
- [ ] User text rendered as text (no `dangerouslySetInnerHTML` with user content)
- [ ] Signed links (e.g. WhatsApp deep links) expire and are bound to user + org

## Webhooks, cron, payments
- [ ] Webhook signature verified on the raw body with a constant-time compare; event id ledger prevents replays
- [ ] Cron routes require `CRON_SECRET` (≥32 chars in production), constant-time compare
- [ ] Payments: server-side prices only; webhook is the source of truth; test vs live keys separated

## Headers and platform
- [ ] Security headers present (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`) — `scripts/verify-production`
- [ ] Production not behind Vercel Deployment Protection where cron/webhooks call it; previews may be
- [ ] Logs contain ids and counts only (no emails, phones, tokens, bodies)

## Sign-off
- [ ] security-reviewer handoff written with findings and decisions ([../factory/HANDOFFS.md](../factory/HANDOFFS.md))
