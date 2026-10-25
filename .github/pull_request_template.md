## What changed
<!-- User-visible behaviour first, then the technical change. -->

## Task / handoff
<!-- Task id from factory/TASK_GRAPH.md. Paste the handoff block (factory/HANDOFFS.md format). -->

## Checks
- [ ] `npm run check:full` green locally (lint, typecheck, tests, build)
- [ ] Migrations (if any) inside my range, reviewed, `npm run db:local-check` green
- [ ] Permissions changed in BOTH `src/lib/permissions.ts` and RLS (or not touched)
- [ ] New env vars added to `.env.example` with a class tag (or none)
- [ ] Checked at 375 / 430 / tablet / desktop, light and dark (UI changes)
- [ ] Preview deployment opened and the changed flow tried by hand

## Risks / not done
<!-- Be specific. "None" only if true. -->
