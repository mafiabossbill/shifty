# Workflow: UI redesign

Owner: ux-architect (plans, tokens, primitives) → frontend-engineer (screens) → pwa-mobile-engineer (phone pass) → design review. Standard: [../docs/UI_UX_STANDARD.md](../docs/UI_UX_STANDARD.md).

| # | Step | Done when |
| --- | --- | --- |
| 1 | `npm run design:shots` on the current state; add gallery pages for screens that have none | Baseline images of every screen at 375 and 1280, light and dark |
| 2 | Review the baseline against [../checklists/design-review.md](../checklists/design-review.md) and write what is wrong, as findings against sections of the standard, not as taste | Findings table; changes to tokens or primitives agreed in `factory/DECISIONS.md` |
| 3 | Rewrite the screen plan of each screen that changes (purpose, primary action, ranked content, states) | Blueprint § Screens updated |
| 4 | Change tokens and primitives first, in one PR | `npm run check` PASS; `/design` looked at; every screen still renders |
| 5 | Screens in lanes by ownership | Each lane's handoff with its design review verdict |
| 6 | Phone pass and theme pass after the lanes | [../checklists/responsive.md](../checklists/responsive.md) ticked |
| 7 | Design review by an agent that built none of it, then QA on preview | `DESIGN REVIEW: PASS`; no sideways scroll, 44px targets, AA contrast |

Never: a new colour, size or shadow outside the system; decoration; card grids replacing tables; a second button style for the same rank; a screen changed without being looked at.
