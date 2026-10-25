# Workflow: production release

Owner: release-engineer (single owner). Skill: `/release`. Standard: [../docs/RELEASE_STANDARD.md](../docs/RELEASE_STANDARD.md).

```bash
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
