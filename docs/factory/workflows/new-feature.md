# Workflow: new feature

Owner: orchestrator (small features: the builder runs it). Skill: `/new-feature <request>`.

| # | Step | Command / artefact | Done when |
| --- | --- | --- | --- |
| 1 | Capture the request; record assumptions | [../intake/FEATURE_REQUEST_TEMPLATE.md](../intake/FEATURE_REQUEST_TEMPLATE.md) | Acceptance criteria are testable |
| 2 | Route: which capabilities and agents does it touch? | [../factory/AGENT_ROUTER.md](../factory/AGENT_ROUTER.md) | Owners + migration range assigned in `factory/OWNERSHIP.md` |
| 3 | Data (if needed) | [database-change.md](database-change.md) | `npm run db:local-check` PASS |
| 4 | Permissions in **both** layers | `src/lib/permissions.ts` + migration replacing `private.role_capabilities()` | `tests/permissions.test.ts` PASS |
| 5 | Schemas → repository → route → route tests | `src/lib/validation.ts`, `src/lib/data/`, `src/app/api/` | signed-out / forbidden / invalid / success covered |
| 6 | UI with all states | table desktop, cards phone, drawer, confirm on destructive | 375/430/768/1280 × light/dark checked |
| 7 | Security review if a trigger fires | [../checklists/security.md](../checklists/security.md) | No blockers |
| 8 | PR with handoff; QA on preview | `npm run check:full`; `scripts/check --e2e <preview>` | QA PASS |
| 9 | Update `PRODUCT.md`, README, `.env.example` | — | Docs match behaviour |
