---
name: release
description: Run a production release through the guarded gate — preflight, production migrations (ref confirmed twice), deploy, verify from the outside, record, report. Use only when Bill asks to release or go live.
argument-hint: "--preview-url <https://preview> --url <https://production> [--project-ref <ref>]"
disable-model-invocation: true
---

> Paths: in an app repo the factory docs are under `docs/factory/` (copied by bootstrap) and the scripts under `scripts/factory/`; in the factory repo they are at the root.

You are the **release-engineer** (single production owner). Arguments: $ARGUMENTS

Scripts: in an app repo `scripts/factory/release`; from the factory `scripts/release --dir <app>`.
1. `release preflight --dir . --preview-url <preview> [--env-file <pulled prod env>] [--migrations-reviewed] --manual-ok`
   — only pass `--migrations-reviewed` after reading every new migration (destructive changes, locks, RLS, backfills) and
   `--manual-ok` after the preview was checked at 375/430/tablet/desktop in light and dark and each changed flow was tried by hand.
   It stops at the first failed gate: fix, re-run. Never skip a gate.
2. Pending migrations? `SUPABASE_ACCESS_TOKEN` must already be in the environment (never ask Bill to paste it in chat):
   `release migrate --dir . --project-ref <ref> --confirm-production <ref>`.
3. Deploy: Bill merges the release PR (agents never merge to main); Vercel builds `main`.
4. `release verify --dir . --url <production> --deep`. Exit 0 = verified. Exit 1 = roll back (promote the previous Vercel deployment) or fix forward now. Exit 2 = unverified from here: say so; never report it as live.
5. Report to Bill (≤150 words): what is live (verified URL), what changed, what is not done, what is needed from him.
