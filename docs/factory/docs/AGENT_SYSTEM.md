# Agent system

How the factory's agents work together: roles, the default pipeline, ownership, parallel work, shared memory,
handoffs, and how it maps onto Claude Code (verified against **Claude Code 2.1.308** and the docs at
code.claude.com on 2026-10-22).

## Roles
| Agent | One-line role | Contract |
| --- | --- | --- |
| orchestrator | Plans, picks the team, assigns ownership, integrates, triggers QA and release | [../agents/orchestrator.md](../agents/orchestrator.md) |
| product-architect | Brief → outcome and evidence, `PRODUCT.md`, validated blueprint ([PRODUCT_DISCOVERY_STANDARD.md](PRODUCT_DISCOVERY_STANDARD.md)) | [../agents/product-architect.md](../agents/product-architect.md) |
| ux-architect | A plan for every screen, then shell, navigation, the design system and its gallery; reviews screens it did not build ([UI_UX_STANDARD.md](UI_UX_STANDARD.md)) | [../agents/ux-architect.md](../agents/ux-architect.md) |
| frontend-engineer | Feature screens built from the system, each in the gallery and looked at | [../agents/frontend-engineer.md](../agents/frontend-engineer.md) |
| backend-engineer | Routes, validation, rules, repositories | [../agents/backend-engineer.md](../agents/backend-engineer.md) |
| database-engineer | Migrations (own range), RLS, capability mirror, RLS proof | [../agents/database-engineer.md](../agents/database-engineer.md) |
| supabase-engineer | Auth/SMTP/URLs, storage, realtime, Vault, pg_cron, environments | [../agents/supabase-engineer.md](../agents/supabase-engineer.md) |
| integration-engineer | WhatsApp, email, Stripe, push, PDFs, webhooks (mock/live) | [../agents/integration-engineer.md](../agents/integration-engineer.md) |
| pwa-mobile-engineer | Phone layouts, safe areas, manifest, SW, push opt-in | [../agents/pwa-mobile-engineer.md](../agents/pwa-mobile-engineer.md) |
| devops-engineer | Repo, CI, Vercel, env vars, domains, verification | [../agents/devops-engineer.md](../agents/devops-engineer.md) |
| security-reviewer | Read-only review on mandatory triggers | [../agents/security-reviewer.md](../agents/security-reviewer.md) |
| qa-engineer | Independent verification with evidence | [../agents/qa-engineer.md](../agents/qa-engineer.md) |
| release-engineer | Single production owner: gate, migrate, deploy, verify, rollback | [../agents/release-engineer.md](../agents/release-engineer.md) |
| documentation-engineer | README, runbooks, go-live pack, release notes | [../agents/documentation-engineer.md](../agents/documentation-engineer.md) |

Selection: [../factory/AGENT_ROUTER.md](../factory/AGENT_ROUTER.md).

## Default pipeline (phases 0–17)
| # | Phase | Owner | Output | Gate to next phase |
| --- | --- | --- | --- | --- |
| 0 | Understand | orchestrator | Brief + recorded assumptions; batched questions only if they change behaviour/architecture/security/money/irreversible infra | Assumptions written |
| 1 | Blueprint | product-architect | `PRODUCT.md`, `factory/blueprint.json` | Schema validation PASS |
| 2 | Architecture | orchestrator | Router decision, `TASK_GRAPH.md`, `OWNERSHIP.md`, `DECISIONS.md` deviations | No ownership overlap |
| 3 | Data model | database-engineer | Core migrations, capability map both layers | `db:local-check` PASS |
| 4 | Screen plans, shell / design system | ux-architect (+ devops: bootstrap, CI) | A plan per screen; shell, nav per role, primitives, tokens, gallery | `check` PASS (incl. `design:check`), every screen planned |
| 5 | Core features | frontend + backend lanes | Core loop end to end | Lane handoffs, `check` PASS |
| 6 | Integrations | integration-engineer | Mock mode complete; live when credentials exist | Mock tests PASS |
| 7 | Responsive | pwa-mobile-engineer / frontend | Mobile pass at 375–1280, both themes | `checklists/responsive.md` |
| 8 | PWA | pwa-mobile-engineer | Manifest, icons, SW, install/push | `checklists/pwa.md` |
| 9 | Security | security-reviewer | Review, fixes by owners | No blockers |
| 10 | Testing | qa-engineer + owners | Missing tests, e2e journeys | `check --build --db` PASS |
| 11 | Preview | devops-engineer | Preview URL per PR; smoke on deploy | `verify-production <preview> --www skip` PASS |
| 12 | QA and design review | qa-engineer; ux-architect on screens it did not build | Flow × role × width report; design verdict from screenshots | All PASS; `DESIGN REVIEW: PASS` |
| 13 | Production infra | devops + supabase engineers | Prod Supabase, Vercel env (prod), SMTP, Vault | `env-check --environment production` PASS |
| 14 | Domain | devops-engineer | DNS, SSL, Auth URLs, webhooks moved | `docs/DOMAIN_STANDARD.md` order done |
| 15 | Production deploy | release-engineer | Preflight, migrate, deploy | `release preflight` PASS |
| 16 | Production verification | release-engineer | `release verify`, live integration test, phone install | PASS (exit 0) |
| 17 | Docs / handoff | documentation-engineer + orchestrator | README, runbook, go-live pack, report to Bill | Bill has URL + what's needed |

Small apps collapse phases (e.g. 7+8, 11+12); the order never changes.

## Ownership and parallel work
- One owner per file glob per task (`factory/OWNERSHIP.md`). Shared files have one owner; others request changes.
- **Every migration writer gets a numeric range** (0020–0099, 0100–0199, …). The runner and tests refuse duplicates.
- Foundations land first; parallel lanes branch from the merged foundation; cross-cutting passes run after their waves.
- Conflicting lanes → an explicit integration task (e.g. one PR that combines four sessions and fixes a migration clash).

## Shared memory
| File (in the app repo) | Purpose | Writer |
| --- | --- | --- |
| `factory/STATE.md` | Snapshot, assignments, blockers, credential status (names only), verified facts, log | orchestrator (+ agents append to Log) |
| `factory/TASK_GRAPH.md` | Tasks, owners, dependencies, lanes, merge order | orchestrator |
| `factory/OWNERSHIP.md` | File globs and migration ranges | orchestrator |
| `factory/DECISIONS.md` | Deviations and architectural choices | orchestrator / any agent proposing |
| `factory/HANDOFFS.md` | Every task's handoff block | each agent |
| `factory/RELEASES.md` | Release gate and verification log | `scripts/release` |
| `factory/blueprint.json` | Machine-readable blueprint | product-architect |

Git is the transport: sessions read these files at start and commit updates with their work.

## Handoffs
Fixed block (see [../factory/HANDOFFS.md](../factory/HANDOFFS.md)): AGENT, TASK, FILES CHANGED, WHAT WAS IMPLEMENTED,
IMPORTANT DECISIONS, DEPENDENCIES, KNOWN RISKS, TESTS RUN, TEST RESULTS, NEXT AGENT ACTION, COMMIT.
The same block goes in the PR body. "Not run: <reason>" is allowed; invented results never are.

## Claude Code integration (verified mechanisms only)
| Mechanism | Where | What we use it for | Verified |
| --- | --- | --- | --- |
| Project memory | `CLAUDE.md` (imports `AGENTS.md` via `@AGENTS.md`) | Rules and commands | docs: memory |
| Subagents | `.claude/agents/<name>.md`, frontmatter `name`, `description`, `tools`, `model` | The 14 agents (synced from `agents/`) | docs: sub-agents; fields `name`/`description` required |
| Skills (slash commands) | `.claude/skills/<name>/SKILL.md`, frontmatter `description`, `argument-hint`, `disable-model-invocation` | `/new-app`, `/orchestrate`, `/new-feature`, `/bug-fix`, `/database-change`, `/release`, `/verify-production` | docs: skills |
| Hooks | `.claude/settings.json` → `hooks.Stop` / `hooks.SubagentStop`, `type: "command"`, exit 2 blocks with stderr as the reason, `stop_hook_active` input | Quality gate: block "done" while `npm run check` fails | docs: hooks reference |
| Permissions | `.claude/settings.json` → `permissions.allow` / `deny` | Allow check commands; deny reading `.env*` | docs: settings |
| Worktrees | subagent frontmatter `isolation: worktree` / `EnterWorktree` | Optional for parallel builders in one session | docs: sub-agents |
| Cloud sessions | Started by the orchestrator's start-session tool in the desktop app (or by Bill at claude.ai/code) | One session per lane, one agent each, own branch, PR, the app's own cloud environment; a cloud session cannot start other sessions | docs: claude-code-on-the-web |
| Subagents in one session | `claude --agent orchestrator`, or `solo` in `/new-app` / `/orchestrate` | Only when Bill asks for `solo`: the orchestrator runs the lanes as subagents in one session | CLI `--help` (2.1.308) |

Not used on purpose: plugins/marketplaces (overkill for one team), HTTP/agent hooks (command hooks suffice),
`bypassPermissions` (gates must stay meaningful).

**Verified live on 2.1.308** (non-interactive `claude -p` probes, 2026-10-22):
- All 14 project subagents load from `.claude/agents/`; skills `/bug-fix`, `/database-change`, `/new-feature`, `/verify-production`
  are visible to the model, while `/new-app` and `/release` are hidden from it (`disable-model-invocation: true`), as documented.
- The app `Stop` hook fired on a deliberate type error, blocked the stop, and fed the `npm run typecheck` output back; Claude then
  investigated the file. Gate works end to end.
- **Workspace trust:** `permissions.allow` in a project's `.claude/settings.json` is ignored until the folder is trusted (interactive
  trust dialog), and subagent-frontmatter hooks need trust too — but hooks in `settings.json` run regardless. That is why the
  factory puts its gates in `settings.json`, never in agent frontmatter. Accept the trust dialog once per repo on a new machine.

## Session model (how Bill works)
| Session | Where | Started by | Does |
| --- | --- | --- | --- |
| Orchestrator (one per app) | Claude desktop app, Local: first the factory folder, then the app's folder | Bill (`/new-app`, later `/orchestrate`) | Plans, starts lanes, verifies and merges their PRs, reports. Builds nothing |
| Lane (one per lane, per wave) | Cloud, the app's repo and its own cloud environment | The orchestrator, on a turn Bill started | Works as one agent (`.claude/agents/<name>.md`): installs, builds, tests, opens a PR |

1. Bill gives the orchestrator a brief (one long message is normal) with `/new-app` in a **local desktop session** in the factory folder. A cloud or terminal session stops and says so: it cannot start other sessions.
2. The orchestrator does phases 0–2 (blueprint, risk profile, graph, ownership), `gh repo create`, bootstrap (no install), push. It moves itself into the app's folder, checks the app's cloud environment and asks Bill to reply `go`.
3. On `go` it starts the foundation lane. On `continue` it merges the lane PRs that pass verification and starts the next wave: parallel lanes, then cross-cutting, review and release. Each launch carries a self-contained brief (`.claude/skills/orchestrate/LANE_BRIEF.md`): agent, goal, owned files, forbidden files, migration range, tests, handoff. Each lane works on its own branch and opens a PR.
4. Lanes can't message back. On `check` the orchestrator verifies through GitHub (branch, PR body handoff, CI) and Vercel (preview build, logs — Hobby keeps ~1 hour).
5. Merging: while the app isn't live, the orchestrator merges verified lane PRs (green checks, files and migrations inside the lane's limits, handoff present). Bill merges the production release and everything on a live app (unless he says `auto-merge`); `I'll merge` gives him the button back at any time. Lanes never merge. Conflicts go to an integration lane.
6. Why one orchestrator and no hand-off: the desktop app starts sessions only on a turn the user started, so an orchestrator started by another session can't launch lanes. A launch that doesn't start is reported with the one thing Bill must do; it is never replaced by building in the orchestrator.
7. Credentials: never in chat. Secrets go into Vercel env vars or the cloud environment's settings. A pasted secret is exposed → rotate. The app's cloud environment may start empty (lanes prove migrations on local Postgres and run in mock mode); it never holds another app's database. Cloud environments often lack the service-role key: admin paths are tested with mocks and verified live after deploy.
8. `solo` in Bill's message is the only way to get one session building everything (subagents, worktrees).
9. Final report to Bill: short, plain, verified.
