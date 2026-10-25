# TASK GRAPH — SHIFTY

> Written by the orchestrator in phase 2–3, updated as tasks finish. Each task has ONE owner agent,
> explicit dependencies and the files it may touch (see `factory/OWNERSHIP.md`). Lanes run in parallel
> only when their file sets don't overlap. Status: `todo` · `doing` · `review` · `done` · `blocked`.

## Lanes
| Lane | Runs | Agents | Starts after |
| --- | --- | --- | --- |
| L0 Foundation | sequential | database-engineer, ux-architect | blueprint approved |

## Tasks
| Id | Task | Owner | Depends on | Lane | Session / branch | Files (globs) | Migration range | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | Bootstrap app from template (`scripts/bootstrap --blueprint … [--no-example]`) | devops-engineer | — | L0 | orchestrator / main | all | — | todo |

## Merge order
<!-- e.g. T01 → T02 → (T03 ‖ T04) → T05 integration → QA → release -->

## Rules
- Shared foundations (schema core, design primitives, shell) land BEFORE parallel feature lanes start.
- Cross-cutting passes (dark mode, mobile pass, accessibility) run AFTER the feature waves they touch.
- A task is `done` only with a handoff in `factory/HANDOFFS.md` and a green `npm run check`.
