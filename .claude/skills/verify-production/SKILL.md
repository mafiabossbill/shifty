---
name: verify-production
description: Check a deployed URL from the outside — HTTPS, redirects, health, manifest, service worker, public and protected pages, security headers. Use before saying any deployment works.
argument-hint: "<https://url> [--deep] [--www redirect|serve|skip]"
---

> Paths: in an app repo the factory docs are under `docs/factory/` (copied by bootstrap) and the scripts under `scripts/factory/`; in the factory repo they are at the root.

Run `scripts/factory/verify-production $ARGUMENTS` (in an app repo) or `scripts/verify-production $ARGUMENTS` (in the factory).

- Exit 0: report PASS with the commit from `/api/health`.
- Exit 1: list each FAIL line and what it means; don't call the deployment working.
- Exit 2 (UNVERIFIED): this machine can't reach the URL (DNS, proxy, network). Say "unverified", suggest checking the Vercel dashboard or another network. Never guess up or down.
