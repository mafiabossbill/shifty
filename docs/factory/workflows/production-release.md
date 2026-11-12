# Workflow: production release

Owner: release-engineer (single owner). Skill: `/release`. Standard: [../docs/RELEASE_STANDARD.md](../docs/RELEASE_STANDARD.md).

```bash
# 0. Verdict (release-gatekeeper, read-only; needs every guardian verdict + QA sign-off for this commit)
guardrails/scripts/policy-check --profile docs/APP_RISK_PROFILE.md
guardrails/scripts/preflight --dir . --profile docs/APP_RISK_PROFILE.md --url https://<preview>
#    → factory/PRODUCTION_READINESS.md with "VERDICT: PRODUCTION READY" and "COMMIT: <sha>"; NOT READY = stop, route findings
# 1. Gate (stops at the first failure; writes factory/RELEASES.md)
scripts/release preflight --dir <app> --preview-url https://<preview> [--env-file prod.env] [--migrations-reviewed] --manual-ok
# 2. Production migrations, only if pending (project ref typed twice)
SUPABASE_ACCESS_TOKEN=… scripts/release migrate --dir <app> --project-ref <ref> --confirm-production <ref>
# 3. Deploy: Bill merges the PR → Vercel builds main → production
# 4. Prove it from the outside
scripts/release verify --dir <app> --url https://<domain> [--deep]
```

| Outcome of verify | Meaning | Action |
| --- | --- | --- |
| exit 0 | Verified | Tell Bill it is live (URL, what changed) |
| exit 1 | A check failed | Roll back (Vercel: promote previous deployment) or fix forward now; tell Bill plainly |
| exit 2 | Unverified (can't reach from here) | Say "unverified", check from another network/Vercel dashboard; never say "live" |

After verify: core journey by hand on a phone; one live test per integration touched; [../checklists/production.md](../checklists/production.md) for first launches.
Preflight gate 4b (`factory/release-gates.sh`, installed by bootstrap) fails when `factory/PRODUCTION_READINESS.md` is missing, says NOT READY, or names a commit that code changed after. The release-engineer refuses preflight in those cases even before the hook does.
