# Workflow: third-party integration

Owner: integration-engineer (+ security-reviewer for webhooks/payments). Standard: [../docs/INTEGRATIONS_STANDARD.md](../docs/INTEGRATIONS_STANDARD.md).

| # | Step | Done when |
| --- | --- | --- |
| 1 | Write the integration row: provider, direction, data, credentials needed (names), approval lead times (e.g. WhatsApp templates, Meta app publishing) | Bill knows what to provide, in one message |
| 2 | Config with modes: disabled (unset) / mock (flag on, credentials missing) / live | App works with it disabled |
| 3 | Pure parsers/builders + client behind an interface; recorded fixtures | Unit tests PASS |
| 4 | Webhooks: raw-body signature, ledger table with unique provider event id, out-of-order handling | Duplicate delivery test PASS |
| 5 | Jobs: pg_cron + Vault + `CRON_SECRET`; per-period claims | Overlapping-tick test PASS |
| 6 | Env vars in `.env.example` with class tags | `tests/config.test.ts` PASS |
| 7 | Live test with real credentials on preview/production | Date, evidence and result in `factory/STATE.md` Verified; otherwise the blocker with the exact credential |
