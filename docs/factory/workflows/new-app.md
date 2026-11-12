# Workflow: new app (brief → verified production)

Owner: orchestrator. Skill: `/new-app <brief or path>`. Phases: [../docs/AGENT_SYSTEM.md](../docs/AGENT_SYSTEM.md).

## Steps
| # | Step | Who | Command / artefact | Done when |
| --- | --- | --- | --- | --- |
| 0 | Fill the brief, record assumptions, list questions that change behaviour/architecture/security/money/irreversible infra | orchestrator | [../intake/PRODUCT_BRIEF_TEMPLATE.md](../intake/PRODUCT_BRIEF_TEMPLATE.md) | Assumptions table complete; questions sent in one message (or none) |
| 0b | Outcome, people, today's process, opportunities, assumptions with tests ([../docs/PRODUCT_DISCOVERY_STANDARD.md](../docs/PRODUCT_DISCOVERY_STANDARD.md)) | product-architect | § Outcome and evidence of the blueprint | One outcome named; every need has an evidence level; riskiest assumptions have a test |
| 1 | Blueprint | product-architect | [../intake/PRODUCT_BLUEPRINT_TEMPLATE.md](../intake/PRODUCT_BLUEPRINT_TEMPLATE.md) → `factory/blueprint.json` | `node tools/validate-blueprints.mjs <app>/factory/blueprint.json` PASS |
| 1b | Risk profile: guardrail keys derived from the blueprint, scale estimates, tier-3 flags (drafted next to the blueprint; committed as `docs/APP_RISK_PROFILE.md` at step 3) | orchestrator | `guardrails/templates/APP_RISK_PROFILE.md`; `policy-check --profile <profile>` via `GUARDRAILS_DIR` or `guardrails/scripts/policy-check` (routing: `guardrails/integrations/bill-app-factory/GUARDRAIL_ROUTING.md`) | exit 0; activated and not-activated guardians recorded in `factory/STATE.md` |
| 2 | Router decision + task graph + ownership + ranges | orchestrator | [../factory/AGENT_ROUTER.md](../factory/AGENT_ROUTER.md), `factory/TASK_GRAPH.md`, `factory/OWNERSHIP.md` | Chosen and not-chosen agents recorded; no overlaps |
| 3 | Create the repo | devops-engineer | `scripts/bootstrap --blueprint <PRODUCT_BLUEPRINT.md> --dir <app> --no-example` (identity, tenancy, blueprint, ownership ranges, docs, scripts; `"tenancy": "saas"` = `--saas`) | `scripts/check --dir <app> --build --db` PASS |
| 4 | Data model core | database-engineer | migrations in range, capabilities both layers | `npm run db:local-check` PASS |
| 5 | Screen plan for every screen, then shell, nav per role, primitives, gallery | ux-architect | `factory/PRODUCT_BLUEPRINT.md` § Screens ([../docs/UI_UX_STANDARD.md](../docs/UI_UX_STANDARD.md) §2.1), `src/lib/nav.ts`, `src/components/ui/**`, `src/app/design/**` | Every screen has a plan; `npm run check` PASS (includes `design:check`); own screens looked at |
| 6 | Feature lanes (parallel by ownership) | frontend + backend (+ integration) | one branch/PR per lane; each screen in the gallery, photographed and self-reviewed ([../checklists/design-review.md](../checklists/design-review.md)) | Handoffs with test output and the design review verdict |
| 7 | Integrations in mock mode; live once credentials exist | integration-engineer | [integration.md](integration.md) | Mock PASS; live test recorded or blocker named |
| 8 | Responsive + PWA pass | pwa-mobile-engineer | [../checklists/responsive.md](../checklists/responsive.md), [../checklists/pwa.md](../checklists/pwa.md) | Checklists ticked with evidence |
| 9 | Security review (if triggered) | security-reviewer | [../checklists/security.md](../checklists/security.md) | No blockers |
| 9b | Guardrail review of the candidate by every activated guardian (security-reviewer acts as security-guardian) | guardrail-orchestrator + guardians | `guardrails/scripts/preflight --dir . --profile docs/APP_RISK_PROFILE.md --skip-build`; contract `guardrails/integrations/bill-app-factory/AGENT_HANDOFF.md` | `GUARDIAN PASS` / `PASS WITH NOTES` from each activated guardian in `factory/HANDOFFS.md`; no open BLOCKER / MUST-FIX |
| 9c | Design review of every screen from screenshots, by an agent that did not build it | ux-architect (qa-engineer for the ux-architect's screens) | `npm run design:shots`; [../checklists/design-review.md](../checklists/design-review.md) | `DESIGN REVIEW: PASS` or `PASS WITH NOTES` for every screen |
| 10 | QA on preview | qa-engineer | `scripts/check --dir <app> --e2e <preview-url>` + manual flows | All PASS |
| 11 | Production infra + domain | devops + supabase engineers | [../docs/DOMAIN_STANDARD.md](../docs/DOMAIN_STANDARD.md) | `scripts/env-check --environment production` PASS |
| 11b | Legal details | orchestrator + documentation-engineer | Go-live pack §7 → `src/lib/legal.ts`; processors match integrations; new personal data in the export | `npm run legal:check` PASS |
| 11c | Production readiness verdict | release-gatekeeper | `guardrails/templates/PRODUCTION_READINESS.md` → `factory/PRODUCTION_READINESS.md` (header lines VERDICT, COMMIT, PROFILE, GUARDRAILS, DATE) | `VERDICT: PRODUCTION READY` for the release candidate commit |
| 12 | Release (refused without PRODUCTION READY; preflight gate 4b runs `factory/release-gates.sh`) | release-engineer | [production-release.md](production-release.md) | `scripts/release verify` PASS |
| 13 | Go-live pack + report to Bill | documentation-engineer + orchestrator | [../intake/GO_LIVE_DATA_PACK_TEMPLATE.md](../intake/GO_LIVE_DATA_PACK_TEMPLATE.md) | Bill has URL, what works, what's needed |

## Rules
- Steps 0–3 happen in the orchestrator session (desktop app, Local). Steps 4–12 run as one cloud session per lane, started by the orchestrator (`/orchestrate`, brief from `.claude/skills/orchestrate/LANE_BRIEF.md`); with `--no-install` the step 3 check runs in the foundation lane. One session doing every step only when Bill says `solo`.
- Foundations (4–5) merge before lanes (6) start. Cross-cutting passes (8) after the lanes they touch.
- Only stop for real credential boundaries; say the exact variable, where it goes, what it unlocks.
- Never report "live" before step 12 passes.
- Guardians are read-only: findings go back to the owning builder; accepted deviations need `factory/DECISIONS.md` + the profile's `exceptions` list. Only the release-gatekeeper writes PRODUCTION READY.

## Keeping or removing the example entity
The template ships an example `projects` entity as a copyable pattern. Decide in phase 2:
| Choice | When | How |
| --- | --- | --- |
| Remove (default) | Always, unless the first lane wants a live pattern to copy | `scripts/bootstrap --no-example`: deletes `src/app/(app)/projects`, `src/components/projects`, `src/app/api/projects`, `src/lib/data/projects.ts`, `supabase/migrations/0010_projects.sql`, its tests, and every `@example`-marked line (capabilities, nav item, session repository, API client, RLS checks) |
| Keep, then rename into the first real entity | The real entity is close to "projects" | Rename across the same file list in one PR **before the first migrate**; `tests/schema-references.test.ts` catches leftovers |
| Already migrated somewhere | A dev DB applied `0010` | Don't delete the file: add a migration that drops the table and replaces `private.role_capabilities()` |
