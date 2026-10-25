# OWNERSHIP — SHIFTY

> Who may edit what, so parallel sessions never collide. The orchestrator assigns; nobody edits outside
> their row without the orchestrator changing this file first. Shared files have ONE owner; others request changes.

## File ownership
| Agent / session | Owns (may edit) | Must not edit | Shared files it may request changes to |
| --- | --- | --- | --- |
| database-engineer | `supabase/migrations/**` (own range), `scripts/check-rls.ts`, `src/lib/data/**` | UI, routes | `src/lib/permissions.ts` (with security-reviewer) |

## Migration number ranges (every writer of migrations gets one; never reuse a number)
| Range | Owner | Purpose |
| --- | --- | --- |
| 0001–0009 | template | foundation (exists) |
| 0010–0019 | template | example entity (exists; replace or keep) |
| 0020–0099 | database-engineer | core schema |

The runner refuses duplicate versions (`scripts/migrations.ts`); the test suite fails on them too.

## Single owners
| Concern | Owner |
| --- | --- |
| Production release, deploy, rollback | release-engineer |
| Migrations applied to production | release-engineer (database-engineer prepares, `scripts/release` gate) |
| `src/lib/permissions.ts` + RLS helpers | database-engineer, reviewed by security-reviewer |
| Design tokens `globals.css`, `src/components/ui/**` | ux-architect (frontend-engineer requests changes) |
| `factory/STATE.md`, `factory/TASK_GRAPH.md`, this file | orchestrator |
