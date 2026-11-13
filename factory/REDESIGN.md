# SHIFTY redesign

Owner: orchestrator. Started 2026-11-12 on Bill's instruction: redo SHIFTY with the new design rules.
Standard: `docs/factory/docs/UI_UX_STANDARD.md` (factory commit f784c3b). Workflow: `docs/factory/workflows/ui-redesign.md`.
Review: `docs/factory/checklists/design-review.md`. Starter's implementation to port from: `.claude/design-reference/README.md`.

## Why
SHIFTY v1 was built before the factory had an enforced design system. Measured against the new check on 2026-11-12 (`main` @ 4c6dc5d):

| Rule | Errors | | Area | Errors |
| --- | --- | --- | --- | --- |
| `color-tokens` | 407 | | `components/mochi` | 377 |
| `type-scale` | 380 | | `components/sessions` | 152 |
| `spacing-scale` | 137 | | `components/settings` | 119 |
| `font-weight` | 120 | | `components/ui` | 88 |
| `elevation-scale` | 30 | | `components/insights` | 87 |
| `radius-scale` | 23 | | `components/companion` | 62 |
| `no-gradient`, `uppercase`, `motion` | 15 | | `components/home` | 60 |
| **Total** | **1,112** | | shell, auth, legal, pwa, sync, lib, other | 167 |

Seen on the live app: a dark purple theme with a glow around the clock-in button, boxes inside boxes, small capital-letter
labels, a ring chart that answers no question, low-contrast secondary text.

## Decisions (Bill, 2026-11-12)
| # | Decision |
| --- | --- |
| R-D1 | **Look only.** Every feature stays, including Mochi and the rewards. Behaviour, data, routes and URLs do not change |
| R-D2 | Light theme by default; dark stays as an option (Light / Dark / System) |
| R-D3 | No glow, no gradients. The ring chart on Insights becomes plain bars; every chart must answer a question (standard §13) |
| R-D4 | Mochi keeps its own colours: the drawing files carry a `design-ok-file` exception with that reason. The screens around the drawing follow the system |
| R-D5 | The action colour is the system's near-black `--primary`. Violet stays in the logo mark and in Mochi; it does not tint the interface |
| R-D6 | **No database work.** No migrations, no `db:*` script, no change to sync or API behaviour. The cloud environment holds the live database's settings |

## Branches and merging
- `redesign` is the integration branch. Every lane branches from `origin/redesign` and opens its PR **into `redesign`**.
- `main` is production. No lane targets it, and nothing reaches it until the end.
- The orchestrator merges a lane's PR into `redesign` once it passes verification (checks green, files inside the lane's globs, verdict present). Bill merges the one final PR, `redesign` → `main`.

## For the orchestrator
- The orchestrator is a Local desktop session opened in this folder that Bill talks to (`/orchestrate continue the redesign`). It plans, launches, verifies and merges into `redesign`. It builds nothing.
- Each lane is a cloud session on this repository, on the cloud environment `Shifty`. Cloud sessions start from `main`, so every brief's START block moves the lane onto `origin/redesign` and sets the PR base to `redesign`.
- Briefs live in `factory/lanes/R<n>.md`; the launch prompt is the brief's content. R0 is written. Write R1–R5 after R0 is merged, from `.claude/skills/orchestrate/LANE_BRIEF.md`, the ownership table below, the screen plans R0 wrote and the renames listed in `factory/handoffs/redesign-r0.md`. R1–R5 launch together.
- Verify as in the orchestrate skill (step 6), with base `redesign` in place of `main`. Merge a verified lane PR into `redesign` yourself (`gh pr merge <n> --merge`): that is not production. This plan replaces the skill's "live app: Bill merges" rule for lane PRs only.
- Never merge into `main`. After R6 and R7 pass, open the PR `redesign` → `main` with before and after screenshots; Bill merges it.
- Keep the Log at the end of this file current (commit it straight to `redesign`; it is the orchestrator's file).

## Lanes
| Lane | Agent | Delivers | After |
| --- | --- | --- | --- |
| R0 Foundation | ux-architect | The system (tokens, check, gallery, shots), shell and shared primitives restyled, sign-in and legal pages, a screen plan for every screen | — |
| R1 Home | frontend-engineer | Home: clock in, live session, recap, sync status, ribbon | R0 |
| R2 Sessions | frontend-engineer | List, detail, new, trash, corrections | R0 |
| R3 Insights | frontend-engineer | Range dashboard and its widgets, charts per standard §13 | R0 |
| R4 Companion | frontend-engineer | Companion screen, Mochi's surroundings, rewards, achievements | R0 |
| R5 Settings | frontend-engineer | All settings pages, account and data, install guide | R0 |
| R6 Design review | ux-architect (feature screens) + qa-engineer (shell and primitives) | Verdict per screen from screenshots | R1–R5 |
| R7 QA | qa-engineer | Unit, build and browser journeys green; behaviour unchanged | R1–R5 |
| Release | orchestrator opens, Bill merges | PR `redesign` → `main` | R6, R7 PASS |

## Ownership
| Lane | Owns |
| --- | --- |
| R0 | `src/app/globals.css`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/error.tsx`, `src/app/(app)/design/**` (becomes `src/app/design/**`), `src/app/(auth)/**`, `src/app/(legal)/**`, `src/app/no-access/**`, `src/components/ui/**`, `src/components/shell/**`, `src/components/theme/**`, `src/components/auth/**`, `src/components/design/**` (shell and system only), `src/lib/utils.ts`, `src/lib/theme.ts`, `src/lib/public-paths.ts`, `src/lib/design-gallery/**`, `scripts/design-check.ts`, `scripts/design-shots.ts`, `tests/design.test.ts`, `tests/ui-primitives.test.ts`, `tests/public-paths.test.ts`, `package.json` (scripts), `.gitignore`, `CLAUDE.md`, `factory/PRODUCT_BLUEPRINT.md` § Screens, `factory/DECISIONS.md`; and the one-line marker below in any file |
| R1 | `src/components/home/**`, `src/components/session/**`, `src/components/sync/**`, `src/app/(app)/page.tsx`, `src/app/(app)/dashboard/**`, `src/lib/home/**`, `tests/home-*` |
| R2 | `src/components/sessions/**`, `src/app/(app)/sessions/**`, `src/lib/sessions/**`, `tests/sessions-*` |
| R3 | `src/components/insights/**`, `src/app/(app)/insights/**`, `src/lib/insights/**`, `tests/insights-*` |
| R4 | `src/components/companion/**`, `src/components/mochi/**`, `src/app/(app)/companion/**`, `src/lib/companion/**`, `tests/companion-*`, `tests/mochi-*` |
| R5 | `src/components/settings/**`, `src/components/account/**`, `src/components/pwa/**`, `src/components/workspaces/**`, `src/app/(app)/settings/**`, `src/lib/settings/**`, `tests/settings-*` |
| Every lane R1–R5 | Its own file in `src/lib/design-gallery/<area>.ts`, its gallery pages `src/app/design/screens/<area>/**`, its sample data `src/components/design/<area>-samples.ts`, `e2e/**` specs for its screens, `factory/handoffs/redesign-<lane>.md` |

Nobody edits `src/lib/store/**`, `src/lib/time/**`, `src/lib/reports/**`, `src/app/api/**`, `supabase/**` or `public/sw.js`: R-D1 and R-D6.
A feature lane that needs a primitive, a token or a shell change asks in its handoff; it does not edit R0's files.

## How the check comes in without breaking the branch
1. R0 wires `npm run design:check` into `npm test` (`tests/design.test.ts`).
2. Every file R0 does not convert, and that has findings, gets this in its first lines:
   `// design-ok-file: awaiting redesign lane R<n> (<area>)`
3. Each lane removes that marker from every file it owns as it converts it.
4. The registry lists every signed-in route from the start. R0 registers the feature screens as exempt with the reason
   `awaiting redesign lane R<n>`; each lane replaces its exemptions with gallery pages. The registry is one file per area
   (`src/lib/design-gallery/<area>.ts`), so lanes never edit the same file.
5. Tailwind's own text sizes and shadows are switched off by R0. Unconverted screens look wrong on `redesign` until their lane lands. That is expected; `main` is untouched.

## Gallery and sample data
SHIFTY's screens read a client store, not a server session. A gallery page renders the real screen component under the store with
sample data: the demo seed (`src/lib/demo/seed.ts`) for a full state, an empty store for the empty state, and any other state the
screen plan lists (active session, on a break, sync problem, long titles). `npm run design:shots` photographs them all.

## Done
- [ ] `npm run design:check`: 0 errors; no file carries `awaiting redesign`; every remaining exception has a reason and is listed in the review
- [ ] Every signed-in screen is in the gallery in each state; photographed at 375 and 1280, light and dark
- [ ] `DESIGN REVIEW: PASS` or `PASS WITH NOTES` for every screen, from a reviewer who did not build it
- [ ] `npm run check:full` green; browser journeys green (specs updated only where copy or selectors changed)
- [ ] Behaviour unchanged: no change under `src/lib/store`, `src/lib/time`, `src/lib/reports`, `src/app/api`, `supabase`
- [ ] PR `redesign` → `main` open, with before and after screenshots, for Bill

## Log
<!-- newest first: YYYY-MM-DD lane — one line -->
- 2026-11-13 R0 — foundation built on `lane/r0-foundation` (run on Bill's Mac, device mode): system, shell, shared pages, gallery, 67 markers (R1 9 · R2 18 · R3 12 · R4 11 · R5 17), screen plans, D11 to D21; open question for Bill: D13 (the accent row). Handoff: `factory/handoffs/redesign-r0.md`.
- 2026-11-12 orchestrator — branch created; factory docs, agents, skills and the design reference refreshed to factory f784c3b; plan written.
