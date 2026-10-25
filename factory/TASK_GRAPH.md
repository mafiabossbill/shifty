# TASK GRAPH — SHIFTY

> Owner: orchestrator. One owner per task; lanes run in parallel git worktrees (`lane/<name>`) and merge into
> `claude/relaxed-davinci-y8k5u9` in the order below. Handoffs: `factory/handoffs/<lane>.md` → `factory/HANDOFFS.md`.

| Id | Task | Owner | Lane | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| T01 | Brief, assumptions, blueprint (validated) | orchestrator + product-architect | main | — | done |
| T02 | Time engine, reducer, schema, reports, device store, sync contract | orchestrator | main | T01 | done |
| T03 | Design tokens, shell (5-tab nav), primitives, `/design` | ux-architect | ux | T01 | running |
| T04 | Mochi art, habitat, item catalog, moods | frontend-engineer | mochi | T01 | running |
| T05 | Migrations 0100–0199, `commit_shift_event`, RLS, local proof | database-engineer | db | T02 | running |
| T06 | Rewards engine (XP, achievements, rhythm, ledger) | backend-engineer | rewards | T02 | running |
| T07 | Sync API, repository + memory twin, device-mode proxy | backend-engineer | sync | T02, (T05 contract) | running |
| T08 | Home: clock in/out, active hero, breaks, recap, ribbon, sync status | frontend-engineer | home | T03, T04 | todo |
| T09 | Sessions: list, filters, detail timeline, correct, manual, trash | frontend-engineer | sessions | T03 | todo |
| T10 | Insights: ranges, mode toggle, all hero widgets, drill-down | frontend-engineer | insights | T03 | todo |
| T11 | Companion + Settings + privacy + export/import | frontend-engineer | companion-settings | T03, T04, T06 | todo |
| T12 | PWA pass: SW shell cache, manifest, install guide, 375–1280 sweep | pwa-mobile-engineer | pwa | T08–T11 | todo |
| T13 | Security review | security-reviewer | review | T05, T07, T12 | todo |
| T14 | QA: unit + Playwright journeys on preview | qa-engineer | qa | T12 | todo |
| T15 | Preview deploy + verify | orchestrator (devops covered) | main | T14 | todo |

## Merge order
T03 → T04 → T05 → T06 → T07 → T08–T11 (any order; disjoint globs) → T12 → fixes from T13/T14 → T15.
