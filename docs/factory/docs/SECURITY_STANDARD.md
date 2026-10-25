# Security standard

Detail behind [THE_WAY_BILL_MAKES_APPS.md](../THE_WAY_BILL_MAKES_APPS.md) §9–10, §22, §30. Owner: security-reviewer ([AGENT_SYSTEM.md](AGENT_SYSTEM.md)).
Tags: **[U]** universal · **[P]** preferred default · **[S]** product-specific.

## 1. Mandatory review triggers [U]
A change gets a security review (security-reviewer agent, before merge) when it touches any of:

| Trigger | Typical files |
| --- | --- |
| Authentication | `src/proxy.ts`, `src/lib/auth-actions.ts`, `src/app/auth/**`, `src/lib/current-user.ts` |
| Payments | Stripe routes, webhooks, price/plan tables |
| Sensitive data | Personal data, health, salaries, phone numbers, documents |
| File uploads | Storage buckets, policies, upload UI |
| Multi-tenancy | Any table, policy, view or function with `organization_id` |
| Public APIs | Routes reachable without a session, API keys, CORS |
| Webhooks | `src/app/api/**/webhook/**`, signature checks |
| Admin features | Role changes, people creation, impersonation, settings |
| Financial data | Costs, invoices, budgets, exports of money |

## 2. Threat checklist [U]
| Threat | Control | Evidence |
| --- | --- | --- |
| Reading another tenant's data | RLS on every table + `organization_id` filter in repositories + check-rls | `scripts/check-rls.ts` |
| Acting beyond your role | `can()` server-side + `has_capability()` in policies | `src/lib/permissions.ts`, `0001_foundation.sql` |
| UI-only security | Hidden controls are UX; every route re-checks | route handlers |
| Direct DB calls with the anon key | RLS denies; locked fields guarded by triggers | Guard trigger + transaction-local flag |
| Privilege escalation via profile edits | Users can't change their own role/flags (policies + guard triggers) | Policy `with check` + guard trigger |
| Open redirect | `?next=` only same-site relative paths | `safeNextPath()` in `src/lib/utils.ts` |
| Account enumeration | Reset answers the same whether the account exists | `requestPasswordReset()` |
| Forged webhooks | HMAC over the **raw body**, constant time, before parsing | Provider signature helper |
| Replayed webhooks/jobs | Idempotency ledger (unique event id / period) | `webhook_events` table |
| Cron abuse | `Authorization: Bearer CRON_SECRET`, constant time, ≥32 chars | `src/lib/cron-auth.ts` |
| Leaked secrets | Env classes, `env-check` leak scan, no secrets in logs | `scripts/env-check` |
| Malicious uploads | Private bucket, MIME + size limits on the bucket, path policies, signed URLs | `supabase/optional/storage.sql.example` |
| CSV/formula injection | Prefix `= + - @` cells with `'` on export | CSV export helper |
| Clickjacking / sniffing | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | `templates/nextjs-supabase/next.config.ts` |
| Stale sessions after offboarding | Deactivate member → helpers ignore them immediately; "sign out everywhere" | Settings → Security |

## 3. Authentication and sessions [U]
- Supabase Auth; server verifies with `getClaims()`; the proxy only refreshes and redirects pages.
- Email confirmation on; custom SMTP on the company domain; Site URL and redirect list on the production domain.
- Passwords ≥8 chars (same rule client and server); leaked-password protection on where available.
- Reset links: implicit flow, short expiry, fragment cleared from the address bar after use.
- Temporary passwords force a change before anything else (pages redirect, APIs 403).
- Sign-out revokes server-side and clears auth cookies.
- First admin only via `ADMIN_EMAIL` + confirmed email (`claim_admin_bootstrap()`), once.

## 4. Authorization [U]
- One capability map; code never checks role names directly.
- Two layers, always: route check (`can()`) **and** RLS policy (`has_capability()`); `tests/permissions.test.ts` keeps them identical.
- Load the record before deciding when the rule depends on it (owner, department); answer 404 for records the user can't see.
- `security definer` functions: `set search_path`, explicit membership/capability checks inside, `revoke` from `public, anon`, grant only what's needed (`service_role` only for "act as" functions called by webhooks).
- Prove it live after every policy change: `npm run db:check-rls` (and `db:local-check` in CI).

## 5. Secrets [U]
| Rule | Detail |
| --- | --- |
| Where secrets live | Vercel environment variables (per environment) or the cloud environment's settings. Nowhere else |
| Never | In the repo, chat, PR text, logs, URLs, `NEXT_PUBLIC_*`, screenshots |
| **Pasted in chat** | Treat as exposed: rotate at the provider immediately, update Vercel, redeploy, note it in `factory/STATE.md` (name only) |
| Classes | `[public]` browser · `[server]` server, not secret · `[secret]` server secret · `[scripts]` local/CI only (`.env.example` tags) |
| Validation | `scripts/env-check` (tags, NEXT_PUBLIC secrets, required prod values, committed-secret scan); `tests/config.test.ts` (no undocumented env reads) |
| Service role | Server-only module; only cron/webhooks/auth-admin; scope every query by org |
| Rotation | VAPID keys rotate only with a plan (invalidates subscriptions); provider tokens prefer never-expiring **system-user** tokens (Meta) stored as secrets |
| Credential boundary | Stop and say exactly which variable, which environment, where to set it, what it unlocks |

## 6. Webhooks [U]
1. Read the raw body once; verify the provider signature (HMAC-SHA256, constant time) **before** parsing.
2. Answer 401 on a bad signature, 503 when not configured (provider retries later), 200 fast otherwise.
3. Record each event under a unique provider id first; duplicates are acknowledged and skipped.
4. Handle with the service role, scoped to the org resolved from trusted data (e.g. the contact's phone → org), never from the payload's claims alone.
5. Log counts and ids, never bodies or phone numbers (mask to last 4).

## 7. Files and links [U]
- Private buckets only; bucket-level `file_size_limit` + `allowed_mime_types`; path `<org>/<entity>/<uuid>-<name>`; policies check membership and capability from the path.
- Signed URLs ≤1 hour; signed action links (e.g. WhatsApp update links) carry org + profile + task, an expiry, and an HMAC with a dedicated secret.
- Never trust client-supplied MIME or size alone; validate both in the API schema and the bucket.

## 8. Data protection [U]
- Collect only what the product needs; mark personal fields in `PRODUCT.md`.
- Public privacy policy, terms, cookie notice and data-deletion pages (template `(legal)`, all from `src/lib/legal.ts`); `npm run legal:check` blocks release while placeholders remain. Required by law and before Meta/Google reviews.
- People exercise their rights in the app: Settings → Your data downloads everything about them and deletes the account (`delete_own_account()`, proven by check-rls). Never build deletion as a soft flag the user can't see through.
- New personal data → add it to the export (`src/lib/data/account.ts`) and to the privacy policy's "What we collect"; new processor → `LEGAL.processors`.
- Sign-up stores the accepted terms version and time; bump `LEGAL.effectiveDate` on material changes and tell users before they apply.
- Logs and audit diffs exclude secrets; redact sensitive columns per capability when reading audit history.
- Exports respect the same capabilities as the screen (no costs in CSV for roles without `cost:view`).

## 9. Headers and transport [U]
- HTTPS only; HSTS (Vercel); http → https redirect (checked by `scripts/verify-production`).
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal, `poweredByHeader: false`.
- [P] A strict CSP when the app has no third-party scripts; the service worker already has one.

## 10. Review output format [U]
The security-reviewer writes one block per review in the PR and in `factory/HANDOFFS.md`:
```
SECURITY REVIEW — <PR / task id>
SCOPE: <triggers hit, files reviewed>
VERDICT: APPROVE | APPROVE WITH FIXES | BLOCK
FINDINGS:
  [HIGH|MED|LOW] <file:line> — <issue> → <required fix>
VERIFIED: <commands run: check-rls, env-check, tests, manual attempts (e.g. cross-org request → 404)>
RESIDUAL RISK: <what remains and why it's acceptable>
```
BLOCK = merge stops until fixed. HIGH findings are fixed before preview sign-off, not "later".

## 11. Checklist
- [ ] Triggers in §1 identified; review requested when any apply
- [ ] Route checks + RLS for every new read/write; check-rls extended and green
- [ ] No secret in code, logs, chat or `NEXT_PUBLIC_*`; `env-check` green
- [ ] Webhooks: signature first, idempotency ledger, safe failure codes
- [ ] Uploads: private bucket, limits, path policies, short signed URLs
- [ ] Redirects same-site; CSV export neutralizes formulas
- [ ] Security headers present (verify-production)

Related: [SUPABASE_STANDARD.md](SUPABASE_STANDARD.md) · [INTEGRATIONS_STANDARD.md](INTEGRATIONS_STANDARD.md) · [../checklists/security.md](../checklists/security.md)
