---
name: bug-fix
description: Fix a bug the factory way — reproduce with a failing test first, find the root cause, smallest fix, regression test, verify on preview/production. Use when something is broken.
argument-hint: "<bug description or report path>"
---

> Paths: in an app repo the factory docs are under `docs/factory/` (copied by bootstrap) and the scripts under `scripts/factory/`; in the factory repo they are at the root.

Bug: $ARGUMENTS

1. Capture with `intake/BUG_REPORT_TEMPLATE.md` fields (role, device/width, URL, time, exact error). Read Vercel logs now (Hobby keeps ~1 hour).
2. Reproduce first: a failing unit/route test, a script, or exact preview steps. No repro → collect evidence; don't guess.
3. Root cause in one sentence, confirmed by a second source (HTTP response, DB row, log line). "Flaky" is not a cause.
4. Smallest fix in the owning files. Data fixes are migrations with a verification query — never manual production edits.
5. The reproduction test now passes; `npm run check` (the Stop hook enforces it).
6. Verify on the preview; if production was affected, `scripts/factory/verify-production <url>` (in an app) or `scripts/verify-production <url>` (in the factory).
7. Handoff block in `factory/HANDOFFS.md`: root cause, fix, regression test, evidence.
