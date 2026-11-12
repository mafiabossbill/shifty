# Lane brief (fill every field — the cloud session sees nothing else)

```
LANE <id> — <title>  ·  app <name> (<owner>/<slug>)

AGENT: <agent name>. You are this agent for the whole session: read `.claude/agents/<agent name>.md` first (guardians:
`guardrails/agents/<agent name>.md`) and work under that contract (files it may own, quality gates, handoff format).
You are one lane of a larger build; do not start other sessions.

START: from `main` at <sha>. Own branch. `npm ci` first. PR into main at the end. Never merge, force-push or deploy.

GOAL: <what this lane delivers, in 2–4 sentences>
ACCEPTANCE: <numbered, testable criteria from the task graph>

READ FIRST: PRODUCT.md, factory/STATE.md, factory/TASK_GRAPH.md (task <ids>), factory/OWNERSHIP.md,
docs/APP_RISK_PROFILE.md, docs/factory/THE_WAY_BILL_MAKES_APPS.md and the standards for this lane: <docs/factory/...>.

YOU OWN: <globs>
DO NOT EDIT: <globs>  (owned by: <lane names running in parallel>)
MIGRATIONS: <NNNN>–<NNNN> only, proven with `npm run db:local-check`. Apply with `npm run db:migrate` only when the
environment holds this app's Supabase variables. None if blank.

DESIGN (every lane that adds or changes a screen; delete this block otherwise):
- Screens and their plans: <routes; the screen-plan rows from factory/PRODUCT_BLUEPRINT.md § Screens, pasted>
- Read docs/factory/docs/UI_UX_STANDARD.md (§1 the tells, §2 order of work, then the sections for what you build) and
  docs/factory/checklists/design-review.md. Open /design in development first: it shows the whole system.
- Build only from the system. Anything missing (a size, a colour, a component) is requested, not invented: <who owns globals.css
  and src/components/ui/ in this wave>.
- Every screen you build gets a gallery page per state (src/app/design/screens/<feature>/, entry in src/lib/design-gallery.ts,
  sample data in src/components/design/samples.ts: longest, shortest, missing, many, none).
- Run `npm run design:shots`, OPEN the images in factory/screens/ and look at them, fix what you see, repeat.

GUARDRAILS THAT APPLY: <rule ids / triggers from APP_RISK_PROFILE: e.g. T1_UPLOADS, T1_WEBHOOKS>
ENV VARS AVAILABLE (names only, never print values): <list, or "none: mock mode and the local database check">.
Missing service-role key → mock admin paths, flag for a live check.

DONE MEANS:
- `npm run check` green (the Stop hook blocks otherwise); <extra tests: e2e, db:local-check>
- Handoff block appended to factory/HANDOFFS.md; your line in factory/STATE.md updated
- UI lanes: `npm run design:check` 0 errors; the DESIGN REVIEW verdict block (checklists/design-review.md) in the PR body, naming
  every gallery page you looked at
- PR body: what changed, a checklist of what you actually verified, anything needing a live check

FINAL REPORT (≤200 words): branch, PR link, verification, open risks.
```
