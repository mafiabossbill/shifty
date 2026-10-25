# Workflow: bug fix

Owner: the agent owning the affected files. Skill: `/bug-fix <report>`.

| # | Step | Rule |
| --- | --- | --- |
| 1 | Capture | [../intake/BUG_REPORT_TEMPLATE.md](../intake/BUG_REPORT_TEMPLATE.md): expected vs actual, role, device/width, URL, time (logs on Vercel Hobby last ~1 h: read them now) |
| 2 | Reproduce first | A failing unit/route test, a script, or exact preview steps. No repro → gather evidence, don't guess |
| 3 | Root cause | Name the cause in one sentence. "Flaky" is not a cause. Confirm with a second source (DB row, HTTP response) before concluding |
| 4 | Smallest fix | In the owner's files; no drive-by refactors |
| 5 | Regression test | The test from step 2 now passes; it would have caught the bug |
| 6 | Verify | `npm run check`; preview; production too if the bug was there (`scripts/verify-production`) |
| 7 | Handoff | `factory/HANDOFFS.md` block; KNOWN RISKS honest |

Data bugs: fix with a **migration** (never a manual production edit); include a backfill and its verification query.
