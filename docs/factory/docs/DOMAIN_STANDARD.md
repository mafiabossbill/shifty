# Domain standard

Putting an app on its custom domain, in order, without breaking auth, webhooks or email.
Doctrine: [THE_WAY_BILL_MAKES_APPS.md](../THE_WAY_BILL_MAKES_APPS.md) §29. Tags: **[U]** universal · **[P]** preferred default.

## 1. Rules [U]
- Never hardcode a hostname in code until the domain is final; even then prefer `NEXT_PUBLIC_SITE_URL` or the request origin.
- The web manifest stays relative forever (`start_url: "/"`, relative icons): it works on preview URLs and the final domain.
- One canonical host. The other (www or apex) redirects permanently to it.
- The domain is "done" only when `scripts/verify-production https://<domain>` passes and sign-in, password reset email links and webhooks work on it.

## 2. Procedure (do it in this order)

| # | Step | Where | How to check |
| --- | --- | --- | --- |
| 1 | Domain bought/available; registrar and DNS provider known; who has the login | Registrar | Bill confirms access (blocker if not) |
| 2 | Add domain (and www) to the Vercel project | Vercel → Settings → Domains | Vercel shows the required records |
| 3 | Decide canonical: apex (`app.com`) or www; subdomain apps (`matrix.company.com`) need only a CNAME | — | Recorded in `factory/DECISIONS.md` |
| 4 | Create records **with the values Vercel shows** | DNS provider | Apex: A record (or ALIAS/ANAME/flattened CNAME); www or subdomain: CNAME to the Vercel target |
| 5 | Remove conflicting records (old A/AAAA, parking pages, CAA blocking Let's Encrypt) | DNS provider | `dig +short <host> A AAAA CAA` |
| 6 | Redirect non-canonical → canonical (308) | Vercel domain settings | `curl -sI https://www.<apex>/` shows `location: https://<apex>/` |
| 7 | Wait for propagation | — | `dig +short <host> @1.1.1.1` and `@8.8.8.8` return Vercel's values |
| 8 | SSL certificate issued | Vercel shows "Valid Configuration" | `curl -sI https://<host>/` succeeds without `-k` |
| 9 | HTTPS everywhere | — | `curl -sI http://<host>/` → 301/308 to https; HSTS header present |
| 10 | `NEXT_PUBLIC_SITE_URL=https://<host>` in Production env, redeploy | Vercel env | `/api/health` answers on the domain; reset emails link to the domain |
| 11 | Supabase Auth **Site URL** = `https://<host>`; add `https://<host>/**` to redirect URLs (keep localhost/preview for dev projects) | Supabase → Auth → URL Configuration | Sign-up confirmation and password reset links open the domain |
| 12 | OAuth providers (Google, Microsoft…): authorized origins and callback URLs on the domain | Provider console | Sign in with the provider on the domain |
| 13 | Webhooks: WhatsApp callback `https://<host>/api/whatsapp/webhook` (re-verify token), Stripe endpoint `https://<host>/api/stripe/webhook` (new signing secret) | Meta App dashboard, Stripe dashboard | Provider's test delivery succeeds; event ledger row appears |
| 14 | Cron: update Vault `<app>_app_url` to the domain | Supabase SQL / `db:cron`-style script | `select status_code from net._http_response order by created desc limit 3` → 200 |
| 15 | CORS (only if other origins call the API) | Route handlers / provider settings | Preflight from the allowed origin succeeds; others refused |
| 16 | Email: SMTP sender on the company domain with SPF, DKIM, DMARC records | DNS provider + SMTP provider | Provider shows verified; test email lands in inbox, not spam |
| 17 | Robots: production indexable only if public marketing pages exist; app pages `noindex` | `robots.txt` / metadata | `curl https://<host>/robots.txt` |
| 18 | Verify | [../scripts/verify-production](../scripts/verify-production) `https://<host>` | Exit 0; for a subdomain use `--www skip` |
| 19 | Record | `factory/STATE.md` (Production URL), `factory/RELEASES.md` | Commit |

## 3. What breaks if you forget a step

| Forgot | Symptom |
| --- | --- |
| Supabase Site URL / redirect URLs | Confirmation and reset emails link to `localhost` or the old preview; "redirect URL not allowed" |
| `NEXT_PUBLIC_SITE_URL` (or set it too early) | Links in emails point to the wrong host; set before DNS is live → links to a dead host |
| Vault app URL | Cron calls the old host; jobs "Succeed" in `cron.job_run_details` while doing nothing useful |
| WhatsApp callback URL | Inbound messages stop; no replies; Meta disables the webhook after repeated failures |
| Stripe endpoint + new signing secret | Payments succeed at Stripe but the app never records them |
| www redirect | Two hosts with split cookies; users "logged out" on one |
| CAA record | Certificate never issues |
| SPF/DKIM/DMARC | Auth emails land in spam or are rejected |
| Deployment Protection on production | Cron and webhooks get 401 from Vercel, not from the app |
| Hardcoded hostname in code | Previews and the new domain behave differently; installed PWAs open the old host |

## 4. Changing domains later [P]
Repeat steps 2–19 for the new host, keep the old host redirecting (308) for at least a few months, update installed-PWA users (they keep the scope of the old origin: tell them to reinstall).
