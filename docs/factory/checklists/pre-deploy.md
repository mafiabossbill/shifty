# Pre-deploy checklist

Maps one-to-one to the gates of `scripts/release preflight` ([../scripts/release](../scripts/release)). The script stops at the first failure; this list is what each gate means and what to fix.
Standard: [../docs/RELEASE_STANDARD.md](../docs/RELEASE_STANDARD.md).

## Gate 1 — git
- [ ] Working tree clean (`git status` shows nothing except `factory/RELEASES.md`)
- [ ] On `main` (or the declared release branch)
- [ ] `HEAD` equals `origin/main` (pushed; what Vercel builds is what you checked)

## Gate 2 — check (`scripts/check --dir APP --build --db`)
- [ ] lint PASS
- [ ] typecheck PASS (`next typegen && tsc --noEmit`)
- [ ] unit/route/static tests PASS
- [ ] `next build` PASS
- [ ] migrations + RLS on local Postgres PASS (`npm run db:local-check`)

## Gate 3 — environment (`scripts/env-check --environment production [--env-file FILE]`)
- [ ] Every `.env.example` variable has a class tag
- [ ] No secret-looking name exposed as `NEXT_PUBLIC_`
- [ ] Production file (from `vercel env pull`) has every `(required)` runtime variable; URLs are https and not localhost; `CRON_SECRET` ≥ 32 chars
- [ ] No `.env` file committed; no secret patterns in tracked files

## Gate 4 — migrations
- [ ] No migration edited since the last `release-*` tag (add a new one instead)
- [ ] New migrations reviewed against the review checklist in [../docs/RELEASE_STANDARD.md](../docs/RELEASE_STANDARD.md) → pass `--migrations-reviewed`

## Gate 4c — legal (`npm run legal:check`)
- [ ] No `[placeholder]` left in `src/lib/legal.ts`; processors list matches the integrations turned on

## Gate 5 — preview (`scripts/verify-production <preview-url> --www skip`)
- [ ] Health 200 `ok`, manifest valid, `/sw.js` no-cache, public pages 200, protected pages → `/login`, security headers
- [ ] Exit 2 (UNVERIFIED) counts as a failure: verify from a network that can reach the preview

## Gate 6 — manual (`--manual-ok` only when all true)
- [ ] Preview opened at 375, 430, tablet and desktop, light and dark ([responsive.md](responsive.md))
- [ ] Every flow changed in this release tried by hand on the preview
- [ ] Rollback known: Vercel "Promote previous deployment"; migration fix-forward plan written

## After preflight
- [ ] Pending production migrations: `scripts/release migrate --project-ref REF --confirm-production REF` (release owner)
- [ ] Bill merges; Vercel production build green
- [ ] `scripts/release verify --url https://<domain>` → [production.md](production.md) for first launches
