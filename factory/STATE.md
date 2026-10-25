# STATE — SHIFTY

> Shared memory for every session and agent working on `shifty`. The orchestrator owns this file;
> other agents append only to **Log** and their own row in **Agents**. Update it in the same commit as the work.

## Snapshot
| Field | Value |
| --- | --- |
| Phase | 15 — merged to main (PR #7) and deployed to Vercel production; production unverified from the build session; release gate pending SHIFTY's Supabase project |
| Blueprint | `factory/blueprint.json` (validated: yes — `validate-blueprints.mjs` PASS) |
| Production URL | `https://shifty-topaz.vercel.app` (Vercel READY at 4c6dc5d; not verified: unreachable from the build session, Vercel Authentication on) |
| Preview URL | `https://shifty-git-claude-relaxed-davinci-y8k5u9-zigo-s-projects1.vercel.app` (Vercel READY; not reachable from the build session's network; Vercel Authentication on) |
| Supabase project | dev: — · prod: — (SHIFTY has none yet; the environment's keys belong to pasuax-executive-matrix and are never used) |
| Vercel project | `shifty` (`prj_pq5psWEVX24SyIBloA0ISQTrEPKP`), region dub1, linked to GitHub |
| Release owner | release-engineer |

## Agents (this build)
| Agent | Lane | Status | Handoff |
| --- | --- | --- | --- |
| orchestrator | engine, store, sync contract, reports, export, demo, integration | done | this file |
| product-architect | blueprint, PRODUCT.md | done | PRODUCT_BLUEPRINT.md |
| ux-architect | tokens, shell, primitives, `/design` | done | handoffs/ux.md |
| frontend-engineer | mochi, home, sessions, insights, companion-settings | done | handoffs/*.md |
| database-engineer | 0100–0105, RLS proof | done | handoffs/db.md |
| backend-engineer | rewards, sync API | done | handoffs/rewards.md, sync.md |
| pwa-mobile-engineer | SW, install, notify | done | handoffs/pwa.md |
| security-reviewer | review @ 5473646 | approve with fixes (H1, M1–M4, L1–L7 fixed) | scratchpad report |
| qa-engineer | journeys + gates | done — no blockers; 3 medium + 6 low fixed | QA_REPORT.md |

Not chosen: integration-engineer (no third-party APIs in phase 1), devops-engineer (orchestrator created the Vercel project), documentation-engineer (one operator; builders keep docs current).

## Blockers
| Since | Blocker | Needed from | Exactly what is needed |
| --- | --- | --- | --- |
| 2026-10-25 | No Supabase project for SHIFTY → no sign-in/sync, no live RLS proof | Bill | Create a Supabase project "shifty" (eu-west-1, next to dub1); set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public) and `SUPABASE_SERVICE_ROLE_KEY` (secret) in Vercel → shifty → Environment Variables; give the build environment a `SUPABASE_ACCESS_TOKEN` for that project to run `db:migrate` + `db:check-rls` |
| 2026-10-25 | Preview can't be fetched from the build session (proxy 403 on *.vercel.app) | — | Verified locally with the same build; Bill opens the preview himself |
| 2026-10-25 | Vercel Authentication protects previews → a home-screen PWA install hits the Vercel login | Bill | Decide: turn Deployment Protection off for `shifty`, or add a custom domain |

## Credentials status (names only, NEVER values)
| Variable / account | Development | Preview | Production | Where it lives |
| --- | --- | --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL / ANON_KEY | — | — | — | Vercel env / cloud env settings (SHIFTY project, not yet created) |
| SUPABASE_SERVICE_ROLE_KEY | — | — | — | Vercel env only |
| VERCEL_TOKEN | set | — | — | cloud env (used to create the project) |

## Verified (only things checked with evidence)
| Date | What | Evidence |
| --- | --- | --- |
| 2026-10-25 | Blueprint valid | `node tools/validate-blueprints.mjs factory/blueprint.json` → PASS |
| 2026-10-25 | Factory gate | `scripts/check --dir shifty --build --db` → lint, typecheck, unit (400), build, migrations + RLS (91) PASS |
| 2026-10-25 | Browser journeys (device-mode production build, localhost) | `npx playwright test` → 137 passed, 1 skipped (desktop/375/430; fixtures A, B, DST, G, H, I, J, K, M, export, demo, sweep) |
| 2026-10-25 | Migrations + RLS on local Postgres 16 | `npm run db:local-check` → 91 checks PASS |
| 2026-10-25 | Production build without Supabase env | `next build` → all tracking routes static |
| 2026-10-25 | Vercel preview build | Vercel API deployment READY (dub1) |

## Log
<!-- newest first -->
- 2026-10-25 orchestrator — PR #7 merged on Bill's request (D11); Vercel production deployment READY (4c6dc5d); `scripts/release verify` not run (host unreachable from here, no Supabase).
- 2026-10-25 orchestrator — QA findings fixed (day-split rounding, multi-tab reload, touch targets, h1, plurals); full gate + 137 e2e green; PR opened.
- 2026-10-25 orchestrator — all lanes merged; security fixes merged (0105, redirect, device wipe, privacy copy); QA started.
- 2026-10-25 orchestrator — engine, reducer, store, reports, export, demo; lanes ux/mochi/db/rewards/sync/pwa/home/sessions/insights/companion run in parallel worktrees.
- 2026-10-25 orchestrator — bootstrap from factory 9cb65d9; blueprint validated.
