# Production launch checklist

First go-live of an app (and any domain change). Run after [pre-deploy.md](pre-deploy.md) passes. Standards: [../docs/RELEASE_STANDARD.md](../docs/RELEASE_STANDARD.md), [../docs/DOMAIN_STANDARD.md](../docs/DOMAIN_STANDARD.md).

## Company data
- [ ] Go-live data pack received ([../intake/GO_LIVE_DATA_PACK_TEMPLATE.md](../intake/GO_LIVE_DATA_PACK_TEMPLATE.md)): teams/departments, people with roles and contacts, current work in import format, workflow decisions, reporting schedule, domain and email
- [ ] Data imported through the app's import flows (CSV preview with per-row errors), not by SQL
- [ ] Demo/seed data removed; test accounts (`*@example.test`) deleted or clearly marked
- [ ] Locale confirmed: currency, timezone, week start (stored values never converted)

## Accounts and auth
- [ ] Custom SMTP on the company domain configured in Supabase (built-in mailer reaches project members only); SPF/DKIM/DMARC verified
- [ ] Supabase Auth Site URL = production domain; redirect URLs include `https://<domain>/**`
- [ ] `ADMIN_EMAIL` configured (`npm run db:configure`); first admin signed in and claimed Admin
- [ ] People added: invites sent or admin-created accounts (for people who never log in)
- [ ] Password reset tested end to end on a phone (link opens on a different device than requested)

## Public pages
- [ ] `npm run legal:check` PASS (operator, address, contact, jurisdiction, regulator, effective date, processors)
- [ ] `/privacy`, `/terms`, `/cookies`, `/data-deletion` read through once, reachable signed out — required by law and for Meta/Google review
- [ ] Settings → Your data: export downloaded and deletion tried with a test account on the preview
- [ ] Cookie notice still true (no analytics or third-party scripts added without a consent banner)

## Jobs and integrations
- [ ] Vault secrets (`<app>_app_url`, `<app>_cron_secret`) set on the production project; `CRON_SECRET` identical in Vercel
- [ ] After the first tick: `select status_code, error_msg from net._http_response order by created desc limit 5` shows 200s (job "Succeeded" is not proof)
- [ ] Each integration live-tested with real credentials and recorded (WhatsApp message received, email delivered, payment in test mode, push on a device)
- [ ] WhatsApp: app Published, templates approved, payment method on the WABA, webhook subscribed to `messages`
- [ ] Integrations without credentials are in disabled mode and listed as "not live" to Bill

## Domain and deployment
- [ ] Domain procedure complete ([../docs/DOMAIN_STANDARD.md](../docs/DOMAIN_STANDARD.md)); `NEXT_PUBLIC_SITE_URL` set after DNS is live
- [ ] Production migrations applied via `scripts/release migrate`; live RLS PASS
- [ ] `scripts/release verify --url https://<domain>` exit 0 (exit 2 = unverified, not done)
- [ ] Vercel Deployment Protection off for production (cron/webhooks reach it)

## Devices
- [ ] Installed on iPhone (Add to Home Screen) and Android; sign in; core loop done on each
- [ ] Desktop Chrome and Safari: core loop done

## Records and handover
- [ ] `factory/STATE.md`: production URL, Supabase refs (not keys), last green check
- [ ] `factory/RELEASES.md` launch entry with evidence
- [ ] Bill told in plain words: what is live (URL), what was verified, what is not live yet, exactly what is needed from him
