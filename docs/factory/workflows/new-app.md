# Workflow: new app (brief → verified production)

Owner: orchestrator. Skill: `/new-app <brief or path>`. Phases: [../docs/AGENT_SYSTEM.md](../docs/AGENT_SYSTEM.md).

## Steps
| # | Step | Who | Command / artefact | Done when |
| --- | --- | --- | --- | --- |
| 0 | Fill the brief, record assumptions, list questions that change behaviour/architecture/security/money/irreversible infra | orchestrator | [../intake/PRODUCT_BRIEF_TEMPLATE.md](../intake/PRODUCT_BRIEF_TEMPLATE.md) | Assumptions table complete; questions sent in one message (or none) |
| 1 | Blueprint | product-architect | [../intake/PRODUCT_BLUEPRINT_TEMPLATE.md](../intake/PRODUCT_BLUEPRINT_TEMPLATE.md) → `factory/blueprint.json` | `node tools/validate-blueprints.mjs <app>/factory/blueprint.json` PASS |
| 2 | Router decision + task graph + ownership + ranges | orchestrator | [../factory/AGENT_ROUTER.md](../factory/AGENT_ROUTER.md), `factory/TASK_GRAPH.md`, `factory/OWNERSHIP.md` | Chosen and not-chosen agents recorded; no overlaps |
| 3 | Create the repo | devops-engineer | `scripts/bootstrap --blueprint <PRODUCT_BLUEPRINT.md> --dir <app> --no-example` (identity, tenancy, blueprint, ownership ranges, docs, scripts; `"tenancy": "saas"` = `--saas`) | `scripts/check --dir <app> --build --db` PASS |
| 4 | Data model core | database-engineer | migrations in range, capabilities both layers | `npm run db:local-check` PASS |
| 5 | Shell, nav per role, primitives | ux-architect | `src/lib/nav.ts`, `src/components/ui/**` | Screen map; `npm run check` PASS |
| 6 | Feature lanes (parallel by ownership) | frontend + backend (+ integration) | one branch/PR per lane | Handoffs with test output |
| 7 | Integrations in mock mode; live once credentials exist | integration-engineer | [integration.md](integration.md) | Mock PASS; live test recorded or blocker named |
| 8 | Responsive + PWA pass | pwa-mobile-engineer | [../checklists/responsive.md](../checklists/responsive.md), [../checklists/pwa.md](../checklists/pwa.md) | Checklists ticked with evidence |
| 9 | Security review (if triggered) | security-reviewer | [../checklists/security.md](../checklists/security.md) | No blockers |
| 10 | QA on preview | qa-engineer | `scripts/check --dir <app> --e2e <preview-url>` + manual flows | All PASS |
| 11 | Production infra + domain | devops + supabase engineers | [../docs/DOMAIN_STANDARD.md](../docs/DOMAIN_STANDARD.md) | `scripts/env-check --environment production` PASS |
| 12 | Release | release-engineer | [production-release.md](production-release.md) | `scripts/release verify` PASS |
| 11b | Legal details | orchestrator + documentation-engineer | Go-live pack §7 → `src/lib/legal.ts`; processors match integrations; new personal data in the export | `npm run legal:check` PASS |
| 13 | Go-live pack + report to Bill | documentation-engineer + orchestrator | [../intake/GO_LIVE_DATA_PACK_TEMPLATE.md](../intake/GO_LIVE_DATA_PACK_TEMPLATE.md) | Bill has URL, what works, what's needed |

## Rules
- Foundations (4–5) merge before lanes (6) start. Cross-cutting passes (8) after the lanes they touch.
- Only stop for real credential boundaries; say the exact variable, where it goes, what it unlocks.
- Never report "live" before step 12 passes.

## Keeping or removing the example entity
The template ships an example `projects` entity as a copyable pattern. Decide in phase 2:
| Choice | When | How |
| --- | --- | --- |
| Remove (default) | Always, unless the first lane wants a live pattern to copy | `scripts/bootstrap --no-example`: deletes `src/app/(app)/projects`, `src/components/projects`, `src/app/api/projects`, `src/lib/data/projects.ts`, `supabase/migrations/0010_projects.sql`, its tests, and every `@example`-marked line (capabilities, nav item, session repository, API client, RLS checks) |
| Keep, then rename into the first real entity | The real entity is close to "projects" | Rename across the same file list in one PR **before the first migrate**; `tests/schema-references.test.ts` catches leftovers |
| Already migrated somewhere | A dev DB applied `0010` | Don't delete the file: add a migration that drops the table and replaces `private.role_capabilities()` |
