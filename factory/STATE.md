# STATE — SHIFTY

> Shared memory for every session and agent working on `shifty`. The orchestrator owns this file;
> other agents append only to **Log** and their own row in **Agents**. Update it in the same commit as the work.

## Snapshot
| Field | Value |
| --- | --- |
| Phase | 13 — production live at shifty.heyflexx.com; DB migrated + RLS proven; first-org setup (`db:configure`) pending Bill's approval |
| Blueprint | `factory/blueprint.json` (validated: yes — `validate-blueprints.mjs` PASS) |
| Production URL | `https://shifty.heyflexx.com` (runs main @ 4c6dc5d) |
| Preview URL | `https://shifty-git-claude-relaxed-davinci-y8k5u9-zigo-s-projects1.vercel.app` (Vercel READY; not reachable from the build session's network; Vercel Authentication on) |
| Supabase project | prod: `lnusjqtdsrkmzejbpymf` (SHIFTY only; never use `kstpfgsfzyfpgojmltpe`, another product) · Auth site_url `https://shifty.heyflexx.com` + redirect allow-list set |
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
| 2026-10-26 | First organization + admin email not stored yet (`ORG_NAME="SHIFTY" npm run db:configure`) → first sign-in won't become admin | Bill | Approve that command in a session (session auto-mode blocks production writes without in-session approval) |
| 2026-10-25 | Preview can't be fetched from the build session (proxy 403 on *.vercel.app) | — | Verified locally with the same build; Bill opens the preview himself |
| 2026-10-25 | ~~Vercel Authentication on previews~~ | — | Resolved: custom domain shifty.heyflexx.com |

## Credentials status (names only, NEVER values)
| Variable / account | Development | Preview | Production | Where it lives |
| --- | --- | --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL / ANON_KEY | set (cloud env, ref matches) | — | set (`/api/sync/status` configured:true) | Vercel env / cloud env settings |
| SUPABASE_SERVICE_ROLE_KEY | — | — | unverified (Bill reports added) | Vercel env only |
| SUPABASE_ACCESS_TOKEN | set (200 on lnusjqtdsrkmzejbpymf) | — | — | cloud env (Management API: migrate, check-rls) |
| ADMIN_EMAIL | set | — | — | cloud env (for db:configure) |
| VERCEL_TOKEN | set (rotated 2026-10-26; 200 on prj_pq5psWEVX24SyIBloA0ISQTrEPKP) | — | — | cloud env |

## Verified (only things checked with evidence)
| Date | What | Evidence |
| --- | --- | --- |
| 2026-10-26 | Migrations on prod `lnusjqtdsrkmzejbpymf` | `npm run db:migrate` → 0001, 0002, 0004, 0100–0105 applied ("9 migration(s) applied"; there is no 0003 file) |
| 2026-10-26 | Live RLS proof | `npm run db:check-rls` → "Organization isolation and role rules hold (91 checks, incl. SHIFTY)." |
| 2026-10-26 | Production URL | `scripts/factory/verify-production https://shifty.heyflexx.com` → all checks passed (HTTPS, HSTS, /api/health ok @4c6dc5d, manifest, SW no-cache, public pages, /dashboard → sign-in) |
| 2026-10-26 | Supabase wired in production | `GET /api/sync/status` → 200 `{"configured":true,"signedIn":false,…}` |
| 2026-10-25 | Blueprint valid | `node tools/validate-blueprints.mjs factory/blueprint.json` → PASS |
| 2026-10-25 | Factory gate | `scripts/check --dir shifty --build --db` → lint, typecheck, unit (400), build, migrations + RLS (91) PASS |
| 2026-10-25 | Browser journeys (device-mode production build, localhost) | `npx playwright test` → 137 passed, 1 skipped (desktop/375/430; fixtures A, B, DST, G, H, I, J, K, M, export, demo, sweep) |
| 2026-10-25 | Migrations + RLS on local Postgres 16 | `npm run db:local-check` → 91 checks PASS |
| 2026-10-25 | Production build without Supabase env | `next build` → all tracking routes static |
| 2026-10-25 | Vercel preview build | Vercel API deployment READY (dub1) |

## Log
<!-- newest first -->
- 2026-10-26 release-engineer — migrations applied to lnusjqtdsrkmzejbpymf, live RLS 91/91 PASS, verify-production PASS; no redeploy needed (prod already on main @ 4c6dc5d, configured:true); db:configure awaiting Bill's approval.
- 2026-10-25 orchestrator — QA findings fixed (day-split rounding, multi-tab reload, touch targets, h1, plurals); full gate + 137 e2e green; PR opened.
- 2026-10-25 orchestrator — all lanes merged; security fixes merged (0105, redirect, device wipe, privacy copy); QA started.
- 2026-10-25 orchestrator — engine, reducer, store, reports, export, demo; lanes ux/mochi/db/rewards/sync/pwa/home/sessions/insights/companion run in parallel worktrees.
- 2026-10-25 orchestrator — bootstrap from factory 9cb65d9; blueprint validated.
