# Release standard

How a change reaches production and how we prove it works. Doctrine: [THE_WAY_BILL_MAKES_APPS.md](../THE_WAY_BILL_MAKES_APPS.md) §31–33, §38.
Workflow: [../workflows/production-release.md](../workflows/production-release.md). Tags: **[U]** universal · **[P]** preferred default.

## 1. Ownership [U]
- One **release owner** per app: the `release-engineer` agent/session (see [../factory/OWNERSHIP.md](../factory/OWNERSHIP.md)). Nobody else applies production migrations or declares a release live.
- The database engineer prepares and reviews migrations; the release owner applies them through the script.
- Bill merges PRs. Agents never merge to `main`.

## 2. Release types

| Type | Example | Gates |
| --- | --- | --- |
| First launch | New app on its domain | All of §3 + [DOMAIN_STANDARD.md](DOMAIN_STANDARD.md) + [../checklists/production.md](../checklists/production.md) |
| Feature release | New screen, new entity | All of §3 |
| Hotfix | Production bug | All of §3 (no skipping); smallest diff; regression test |
| Config-only | Env var, Vault secret | Change → redeploy (env) → `release verify` |
| Migration-only | Index, backfill | Preflight + `release migrate` + `release verify` |

## 3. The gated flow ([../scripts/release](../scripts/release))

| Step | Command | Gate (stops on failure) |
| --- | --- | --- |
| 1 Preflight | `scripts/release preflight --dir APP --preview-url https://<preview> [--env-file prod.env] [--migrations-reviewed] --manual-ok` | git clean, on `main`, pushed → `scripts/check --build --db` → `scripts/env-check --environment production` → no shipped migration edited, new ones reviewed → `scripts/verify-production <preview> --www skip` → manual checks confirmed |
| 2 Migrate (if pending) | `scripts/release migrate --dir APP --project-ref REF --confirm-production REF` | Passing preflight for this exact commit; `SUPABASE_ACCESS_TOKEN` set; ref typed twice; shows pending first; applies; then **live RLS check** |
| 3 Deploy | Merge to `main` (Bill) → Vercel production build | Vercel build green |
| 4 Verify | `scripts/release verify --dir APP --url https://<domain> [--deep]` | `verify-production` exit 0 |
| 5 Journey | By hand on a phone: sign in, core loop, integration live test | Recorded in `factory/RELEASES.md` and the handoff |

- [U] Every step appends a row to `factory/RELEASES.md` (time, step, commit, result), including stops.
- [U] `--rehearsal` exists only for local dry runs against `http://localhost`; it never writes a preflight stamp.
- [U] Migrations run **before** the deploy that needs them; they must be compatible with the code still running.

## 3b. Gate details added after the simulations
| Gate | Behaviour |
| --- | --- |
| Migration baseline | `release verify` tags a verified commit `release-<date>-<sha>`; the next preflight refuses edits to migrations that existed at that tag. Before the first release, editing template migrations is allowed |
| App-specific gates | If the app has an executable `factory/release-gates.sh` (e.g. "Stripe live keys present", "webhook registered"), preflight runs it as a gate |
| Manual checks | `factory/MANUAL_CHECKS.md` (installed by bootstrap): every box must be ticked for the candidate; `--manual-ok` only when the file doesn't exist |
| Role homes | `--public` / `--protected` lists pass through to `verify-production` in preflight and verify (e.g. `--protected "/dashboard,/today"`) |

## 4. Definition of Done for a release [U]
- [ ] lint, typecheck, tests, build PASS (`scripts/check --build`)
- [ ] Migrations reviewed; local DB + RLS PASS; live RLS PASS after applying
- [ ] Env vars complete for production (`scripts/env-check`)
- [ ] Preview verified (script + by hand at phone and desktop)
- [ ] Production deployed from `main`
- [ ] `scripts/release verify` PASS on the production URL
- [ ] Smoke journey done on a phone; integrations live-tested where touched
- [ ] Domain verified (first launch or domain change)
- [ ] Release notes written; Bill told in plain words

## 5. Migration review checklist [U]
- [ ] File in the owner's number range; name says what it does
- [ ] No edit to a migration already shipped (preflight enforces)
- [ ] Destructive change (drop, rename, type change, NOT NULL on existing data) split: add + backfill + switch now, remove in a later release
- [ ] Long locks avoided on big tables (`create index concurrently` outside a transaction when needed; batch backfills)
- [ ] RLS enabled for new tables; policies use `has_capability()`; `scripts/check-rls.ts` extended
- [ ] Capability changes mirrored in `src/lib/permissions.ts` and `private.role_capabilities()`
- [ ] Audit trigger attached to new business tables
- [ ] Applies cleanly on local Postgres (`npm run db:local-check`)

## 6. Release notes (PR body or `factory/RELEASES.md` entry)
```
Release <YYYY-MM-DD> — <commit>
Live now: <user-visible changes, one line each>
Migrations: <files or none>
Config: <env/Vault changes or none>
Verified: release verify PASS at <url> (<time>); phone journey <done/not done: why>
Not live / known issues: <list or none>
Needed from Bill: <exact item or nothing>
```

## 7. Rollback and fix-forward [U]
| Situation | Action |
| --- | --- |
| `release verify` fails after deploy | Promote the previous Vercel deployment now; then fix on a branch |
| Bad migration | Fix forward with a new migration through the gates; never edit production by hand |
| Integration failing | Turn its flag off (disabled mode) and redeploy; the app keeps working |

## 8. Post-deploy verification [U]
`scripts/verify-production` exit codes:

| Exit | Meaning | What to say |
| --- | --- | --- |
| 0 | Every check passed from here | "Live and verified at <url>." |
| 1 | A check failed | "Deployed but failing: <check>. Rolling back / fixing." |
| 2 | **UNVERIFIED**: the URL could not be reached from this machine (DNS, proxy, network) | "Deployed; not verified from here because <reason>. Verifying from <another place>." Never "it's live", never "it's down" |

## 9. Telling Bill [U]
Short, plain, factual: what is live (URL), what was verified and how, what is not live yet, exactly what is needed from him (a credential name and where it goes, a DNS record, a decision). No "should work", no unverified claims.
