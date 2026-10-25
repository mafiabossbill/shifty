# Integrations standard

Third-party services: WhatsApp, email, Web Push, PDFs, payments, scheduled jobs.
Doctrine: [THE_WAY_BILL_MAKES_APPS.md](../THE_WAY_BILL_MAKES_APPS.md) §19. Workflow: [../workflows/integration.md](../workflows/integration.md).
Tags: **[U]** universal · **[P]** preferred default · **[S]** product-specific.

## 1. Rules for every integration [U]
| Rule | Concretely |
| --- | --- |
| Three modes | **disabled** (flag off: nothing sent, app works) · **mock** (flag on, credentials missing: messages logged with status `mock`, never sent) · **live** (flag + all credentials). Mode visible on a settings page (`/settings/integrations`) |
| Interface first | Client behind an interface (`src/lib/<provider>/`); tests use an in-memory twin |
| Credentials boundary | Variables listed in `.env.example` as `[secret]`; Bill enters values in Vercel / cloud settings. Agents stop at this boundary and say exactly: variable name, where it goes, what it unlocks |
| Proof | "Works" means a recorded **live** test (message received on a phone, payment in test mode, email in an inbox). Mock success is reported as mock |
| Inbound | Verify the signature on the **raw body** before parsing; record each provider event id in a ledger (`webhook_events`, unique) so redeliveries are no-ops; return non-2xx only when you want a retry |
| Outbound | Log provider ids and statuses; never log tokens, phone numbers (mask to last 4) or message bodies in app logs |
| Config errors | Missing secret → 503 with the variable name, never a crash |

## 2. WhatsApp Cloud API [S] (East Africa: staff live in WhatsApp)
### Setup (in order)
1. Meta Business app with the WhatsApp product; WhatsApp Business Account (WABA) linked; sending number added and verified.
2. **System user** token that never expires, with `whatsapp_business_messaging` and `whatsapp_business_management`, assigned to the app and WABA. (User tokens expire within hours/days.)
3. App secret (signature check), phone number id, WABA id, a random verify token and link secret → Vercel env; `WHATSAPP_ENABLED=true`.
4. Webhook: callback `https://<host>/api/whatsapp/webhook`, same verify token, **subscribe to the `messages` field** (statuses arrive there too).
5. **Publish the app** (Live mode). Requires public **privacy policy** and **data deletion** URLs → the template's `/privacy` and `/data-deletion` pages.
6. **Payment method** on the WABA, or business-initiated messages fail.
7. Templates approved before any scheduled send (§2.3).

### Messaging rules
| Rule | Why |
| --- | --- |
| Outside the **24-hour window** only approved templates can be sent | Free text to someone who hasn't written in 24h is rejected |
| A quick-reply button (e.g. **Full report**) opens the window | The tap is an inbound message: reply with rich text and documents (PDF) for that exact period |
| Template variables can't contain newlines (or tabs / 4+ spaces) | Build multi-line content into the body; variables are single-line values |
| Set message validity/TTL deliberately (default ~10 min for time-bound alerts) | Stale summaries shouldn't arrive hours later |
| Role-scope every message | Executives: company; department heads: department; employees: own tasks, never costs |
| Opt-in per person; `STOP`/`START` honoured; unknown numbers stored, never answered | Consent and abuse safety |
| One send per person per period, claimed in a ledger (`whatsapp_digests`) | Overlapping cron ticks and webhook redeliveries never double-send |
| Status callbacks can arrive out of order: never move `read` back to `delivered` | Accurate delivery state |
| Normalize numbers to E.164 with a country default (TZ: `0712…` → `+255712…`) | Matching senders reliably |

### Templates
- Category **Utility**; header text, body with numbered variables, footer `Reply STOP to opt out`, quick replies.
- Meta may reclassify "summary"/"report" templates as **Marketing** (more expensive, opt-out rules). Appeal, or reword as an account alert about the recipient's own items.
- Keep bodies identical to code; a test compares `src/lib/whatsapp/templates.ts` with `docs/whatsapp-templates.md`.
- Without approved templates, sends outside the window are logged `skipped_no_template` (visible, not silent).

### Commands from chat [S]
Pure, unit-tested grammar; updates go through the same database function as the web (`record_progress_update_as()` granted to `service_role` only), so permissions and rules are identical.

## 3. Email [U]
- Supabase's built-in mailer only reaches the project's team members and is heavily rate-limited: configure **custom SMTP on the company domain** before inviting staff or sending resets to real users.
- DNS: SPF, DKIM, DMARC for the sending domain ([DOMAIN_STANDARD.md](DOMAIN_STANDARD.md)).
- Auth templates link to `/auth/callback` (confirmation) and `/reset-password` (implicit flow so links work on any device).
- [P] Product email (digests, notifications) through Resend or the same SMTP; plain, short, one link.

## 4. Web Push [P]
- VAPID keys generated once **per environment** (`npx web-push generate-vapid-keys`); rotating them invalidates every subscription → rotate only on compromise.
- Needs `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and the service-role key (to read recipients' devices); without them notifications stay in-app and settings say "Push not configured".
- iOS/iPadOS: only for the app **installed to the home screen** (16.4+); show "Install to get alerts" instead of a toggle in Safari.
- Delete subscriptions answering 404/410; update `last_used_at` on success.
- Best effort: push never fails the action behind it; the in-app notification is the record.
- Per-type preferences (in-app × push); push requires the type on in-app too.

## 5. PDFs [P]
- `@react-pdf/renderer`, server-side, in a route handler (`maxDuration` for heavy reports).
- Embed fonts (`.woff` files with their licence) and brand assets; include them in functions with `outputFileTracingIncludes` in `next.config.ts`.
- Always light theme, A4, dense tables, page numbers; filename `<product>-<kind>-<YYYY-MM-DD>.pdf`.
- Same role scoping and cost redaction as the screen.
- If generation fails after a text report was sent, send a short "PDF unavailable" note rather than nothing.

## 6. Payments: Stripe [P] (future products)
| Rule | Concretely |
| --- | --- |
| Hosted flows | Stripe Checkout for purchase/subscription; Billing Portal for plan changes and cards |
| Prices server-side | Never trust a client-sent amount; look up Price ids on the server |
| Mapping | `stripe_customer_id` on the organization; subscription state mirrored in a table updated only by webhooks |
| Webhooks | Verify `Stripe-Signature` on the raw body; ledger table keyed by `event.id`; handle `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed` |
| Idempotency | Idempotency keys on create calls; webhook handlers safe to replay |
| Keys | Test keys in dev/preview, live keys only in production; restricted keys where possible |
| Security review | Mandatory ([SECURITY_STANDARD.md](SECURITY_STANDARD.md)) |
| Proof | A test-mode payment end to end on preview; one real low-value payment after launch, refunded |

## 6b. Provider data sync [P] (reading customers' data: Stripe Connect, Google, banks)
| Rule | Detail |
| --- | --- |
| Access | Prefer OAuth/Connect with read-only scopes over pasted API keys; store tokens in a table no `authenticated` role can read (service role only), or Vault |
| Three paths | Backfill (paged, resumable cursor per account) → webhooks for changes (ledger keyed by `(account, event_id)`) → nightly reconcile that repairs drift |
| Limits | Respect rate limits: back off on 429 with jitter; one sync worker per account at a time (advisory lock or claim row) |
| Money | Keep provider amounts in minor units (`money_minor`); compute metrics from stored snapshots, not live API calls |
| Disconnects | Revoked tokens mark the connection broken and tell the owner; never silently show stale numbers as current |

## 6c. Sending documents to external contacts [P] (reports, inspection PDFs to clients)
| Rule | Detail |
| --- | --- |
| Consent | Record who the recipient is, the channel, and consent/basis per organization; WhatsApp to non-users needs an approved **document-header template** and opt-in |
| Ledger | `deliveries` table: document hash, recipient, channel, attempts, provider id, status (queued/sent/delivered/failed); unique per (document, recipient, channel) |
| Resend | Manual resend creates a new attempt, never a new document; failed sends retried by cron with backoff, then surfaced to a person |
| Content | PDFs light theme, embedded fonts, file names `<app>-<kind>-<date>.pdf`; email via `src/lib/email` (modes), WhatsApp via the Cloud API media upload |

## 6d. Email module [U when EMAIL]
Template `src/lib/email` implements the modes: disabled (`EMAIL_ENABLED` unset), mock (on, no key: logged), live (Resend API with
`Idempotency-Key`). Auth emails stay with Supabase SMTP on the company domain.

## 7. Scheduled jobs [P]
- Supabase **pg_cron + pg_net**; app URL and `CRON_SECRET` in **Vault**; job function returns early (no-op) until both exist. Template: `templates/nextjs-supabase/supabase/optional/cron.sql.example`.
- Route checks `Authorization: Bearer CRON_SECRET` in constant time; 503 when the secret is missing.
- Exact-time schedules: run **every minute**; the route decides what is due in each organization's timezone (minute precision, a 60-minute catch-up window, midnight crossing handled).
- Claim before acting: partial unique index per period (`generated_reports … where trigger = 'scheduled'`) or a ledger (`task_alerts`, `whatsapp_digests`), so overlapping ticks never double-act.
- Verify with HTTP responses, not job status: `cron.job_run_details` says *Succeeded* even when the function no-oped for missing Vault secrets. Check `select status_code, error_msg from net._http_response order by created desc limit 5`.
- Re-point after a domain change (Vault app URL).
