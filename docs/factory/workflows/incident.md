# Workflow: production incident

Owner: release-engineer (coordinates), owners of the failing area fix. Goal: restore service first, then root cause.

| # | Step | Detail |
| --- | --- | --- |
| 1 | Confirm from the outside | `scripts/verify-production https://<domain> --deep`; exit 2 means *we* can't reach it — verify elsewhere before declaring an outage |
| 2 | Read logs **now** | Vercel runtime logs (Hobby keeps ~1 h), `/api/health?deep=1`, Supabase logs; confirm any conclusion with a second source (a silent CLI error once produced a wrong "nothing is running" diagnosis) |
| 3 | Stabilise | Recent deploy? Promote the previous Vercel deployment. Integration failing? Turn its flag off (disabled mode). Cron misbehaving? `cron.unschedule` or clear its Vault secret (job becomes a no-op) |
| 4 | Data damage? | Stop writes to the affected area; fix with a migration/backfill, never manual edits; keep the audit log |
| 5 | Secrets exposed? | Rotate immediately (Supabase keys, provider tokens, CRON_SECRET, VAPID only if compromised), update Vercel + Vault, redeploy |
| 6 | Tell Bill | What broke, who is affected, what is restored, what is still broken, next update time — in plain words |
| 7 | Root cause + regression test | [bug-fix.md](bug-fix.md); record in `factory/DECISIONS.md` if a standard changes |

Cron checks: `cron.job_run_details` "Succeeded" does not mean the app was called — check `net._http_response` status codes.
