# Workflow: UI redesign

Owner: ux-architect (primitives, tokens) → frontend-engineer (screens) → pwa-mobile-engineer (phone pass). Standard: [../docs/UI_UX_STANDARD.md](../docs/UI_UX_STANDARD.md).

| # | Step | Done when |
| --- | --- | --- |
| 1 | Screenshot the current state at 375, 430, 768, 1280 in light and dark | Baseline saved |
| 2 | Write what changes and why (principle, not taste): density, hierarchy, consistency, phone reach | Agreed in `factory/DECISIONS.md` if it changes tokens/primitives |
| 3 | Change tokens and primitives first, in one PR | `npm run check` PASS; every screen still renders |
| 4 | Screens in lanes by ownership | Each lane's handoff with before/after screenshots |
| 5 | Phone pass and theme pass after the lanes | [../checklists/responsive.md](../checklists/responsive.md) ticked |
| 6 | QA on preview | No sideways scroll, 44px targets, 16px inputs, AA contrast |

Never: new colours for decoration, gradients, card grids replacing tables, a second button style for the same action.
