---
name: orchestrate
description: Run an app's build (or a release-sized change) as the orchestrator — plan from factory/TASK_GRAPH.md and factory/OWNERSHIP.md, start one Claude Code cloud session per lane (one agent each), verify every lane through GitHub and Vercel, and merge the lanes that pass while the app isn't live yet. The orchestrator never builds a lane itself. Started by Bill, or continued by /new-app in the same session.
argument-hint: "[brief | feature set | go | check | continue | solo | I'll merge]"
disable-model-invocation: true
---

You are the **orchestrator** (contract: `.claude/agents/orchestrator.md`). Task: $ARGUMENTS (empty, `go` or `continue` = resume from
`factory/STATE.md`; `check` = step 6 only, nothing is merged or started).

By running this skill Bill has asked, in words, for **separate sessions**: every lane in its own cloud session, one agent per
session, in parallel where the task graph allows. This session plans, launches, verifies and reports. It builds nothing.

## 1. Can this session start sessions? (before anything else)
| This session has | Do |
| --- | --- |
| A tool whose name ends in `start_session` (search the deferred tools for `start_session` and `list_start_targets` before deciding it is missing) | Orchestrate: steps 2–8 |
| No such tool (cloud session, terminal, headless run) | **Stop. Build nothing.** Tell Bill in ≤60 words: this session can't start other sessions; in the Claude desktop app choose New session → **Local** → this app's folder, and send `/orchestrate` |
| Bill's message says `solo` | Only then: build in this one session with the subagents in `.claude/agents/` (same waves, one owner per file, same migration ranges). Say "solo mode" in the first line of every report |

A refused, failed or missing launch is **never** a reason to build here or to use subagents instead. Report it (step 5).

## Rules
- No `npm install`, builds, tests or app code in this session. Every lane does that in its own cloud session.
- One orchestrator per app: this session. Never start another orchestrator; lanes never start sessions.
- **One cloud environment per app**, named after the app slug, holding only this app's variables. It may start with **no
  variables**: lanes then prove migrations with `npm run db:local-check` and run integrations in mock mode. Add
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN` once the app's Supabase project exists
  (network allowlist: `api.supabase.com`, `*.supabase.co`). Never `Default` or any environment that holds another app's database.
- Cloud sessions can't message back. Truth comes from GitHub and Vercel, never from a session's own claims.
- **Who merges** (decision F14). Lanes never merge.
  | App | Lane PRs are merged by |
  | --- | --- |
  | Not live yet (no production URL in `factory/STATE.md`, no passed release in `factory/RELEASES.md`) | You, on `continue`, once the PR passes every check in step 6 |
  | Live | Bill, because `main` ships to real users. You merge only if his message for this change says `auto-merge` |
  | Any app, when Bill said `I'll merge` | Bill, until he says otherwise |
  The production release is always Bill's: the release lane prepares it, Bill merges the release PR. Never force-push or deploy.

## Steps
2. **Before the first launch** (once per conversation):
   - App repo `<owner>/<slug>` = `git remote get-url origin` in the app's checkout; `main` is pushed.
   - Call the list-start-targets tool. `thisComputer.projectFolder` is the app's checkout → launch without `repository`.
     It is another folder (e.g. the factory) → pass `repository: <owner>/<slug>` on every launch.
   - `cloud.targets` has an environment named after the slug (any letter case) → use that exact name. Missing → stop and tell Bill:
     claude.ai/code → environment menu → add environment, the name, the allowlist above, variables optional for now.
3. **Read state:** `PRODUCT.md`, `factory/STATE.md`, `factory/TASK_GRAPH.md`, `factory/OWNERSHIP.md`, `factory/HANDOFFS.md`,
   `docs/APP_RISK_PROFILE.md`; `gh pr list --state all`, recent branches. Then the waves:
   1. Foundation — one lane: schema core, app shell, shared primitives, and the ux-architect's **screen plan for every screen**
      in the task graph (`docs/factory/docs/UI_UX_STANDARD.md` §2.1). It is merged before anything else starts; no feature lane
      is launched for a screen that has no plan.
   2. Feature lanes in parallel — one cloud session each, disjoint file globs, own migration range.
   3. Integration lane — only if lane PRs conflict.
   4. Cross-cutting — mobile/PWA pass, dark mode, a11y, after the lanes they touch.
   5. Review — guardrail/security review, QA, and a **design review lane** in parallel (read-mostly lanes). The design reviewer
      is the ux-architect for screens it did not build (the qa-engineer for the ux-architect's own): it runs `npm run design:shots`,
      opens every image and writes the verdict of `docs/factory/checklists/design-review.md`. A FAIL goes back to the lane that owns
      the screen; the release lane does not start on a FAIL.
   6. Release — one release-engineer lane: preview, then production via `scripts/factory/release` (`docs/factory/workflows/production-release.md`).
4. **Launch each lane** with the start-session tool. Before each call write a bold title line and one sentence; mark a chapter
   before launching several. Launch one lane of the wave, read the result, then the rest of the wave in the same turn.
   | Field | Value |
   | --- | --- |
   | `initiation` | `user_asked` (Bill asked for one session per lane) |
   | `context` / `target` | `fresh` / `cloud` |
   | `environment` | the app's environment, exactly as listed |
   | `repository` | only when step 2 says so |
   | `title`, `name` | `<App> lane <id>: <title>` (under 60 characters), `lane-<id>` |
   | `prompt` | [LANE_BRIEF.md](LANE_BRIEF.md) with every field filled, the lane's **agent** included |
   | `background` | ≥ 80 characters: the product in two lines, what is merged so far, how this lane fits |
5. **A launch that doesn't start** — say which lane, quote the refusal, and give Bill the one thing to do:
   | The app says | Bill does |
   | --- | --- |
   | No cloud environment / environment unknown | Creates the environment (step 2), replies `go` |
   | No access to the repository | GitHub → Settings → Applications → Claude → Configure → All repositories, replies `go` |
   | The session is waiting as a card | Clicks the card to start it |
   | This turn wasn't started by Bill (this session was started by another session) | Replies `go` here: sessions start only on a turn Bill started |
   | Another repository isn't allowed from this folder | New session → **Local** → the app's folder → `/orchestrate` |
6. **Verify** each lane PR on `check` and on `continue`. A PR passes only when all of these hold:
   | Check | How |
   | --- | --- |
   | Open, not a draft, into `main`, no conflicts | `gh pr view <n> --json state,isDraft,baseRefName,mergeable` |
   | Every check on the head commit is green, CI and the Vercel build; no checks reported = not verified | `gh pr checks <n>` |
   | Changed files are inside the lane's globs (plus `factory/STATE.md`, `factory/HANDOFFS.md`) | `gh pr diff <n> --name-only` vs `factory/OWNERSHIP.md` |
   | Migration numbers are inside the lane's range | same file list |
   | PR body has the handoff and a checklist of what was actually verified | `gh pr view <n> --json body` |
   | Review lanes: verdict is PASS or PASS WITH NOTES, no open BLOCKER / MUST-FIX | `factory/HANDOFFS.md` in the PR |
   | UI lanes: the PR adds a gallery page for each screen it adds (`src/app/design/screens/**`, `src/lib/design-gallery.ts`) and its body has the DESIGN REVIEW verdict block naming the pages looked at; `design-ok` exceptions added by the PR each have a reason | `gh pr diff <n> --name-only`, `gh pr diff <n>` for `design-ok`, the PR body |
   Fails or can't be verified → don't merge; say which check failed and relaunch the lane with a tighter brief.
7. **Merge and move on**, on `continue`:
   1. When the "Who merges" rule gives you the merge: `gh pr merge <n> --merge` for each passing PR, in the task graph's merge
      order. A PR that conflicts after an earlier merge → integration lane, not a forced merge. Otherwise give Bill the PR
      links in merge order and stop.
   2. `main` must be green after the wave's merges (checks on the merge commit). Still running → say so and ask for `continue`
      again in a few minutes. Red → stop and launch a fix lane.
   3. Launch the next wave whose dependencies are all merged (step 4).
   Lanes update `factory/STATE.md` and `factory/HANDOFFS.md` in their PRs. Credentials: name the exact variable, where it goes
   (Vercel / cloud environment / Supabase / provider), what it unlocks.
8. **Report** in ≤150 words: PRs merged, PRs not merged and why, sessions started (lane → agent), what Bill must do (usually
   nothing). Last line: "Say `check` for status, `continue` to merge what's ready and start the next round." Nothing is "live"
   before `scripts/factory/release verify` passes.

On a later turn (`go`, `check`, `continue`, "merged"), re-read this file first if these steps are no longer in view.

## Never
Building a lane in this session without Bill's `solo` · a second orchestrator session · merging a PR that failed or skipped a
check in step 6 · merging on a live app without Bill's `auto-merge` · merging the production release · two open lanes owning one file · a
migration writer without its own range · a lane launched on another app's environment · a feature lane for a screen with no screen plan · merging a UI lane whose screens nobody looked at · calling a lane done without its PR
checklist and a green build · skipping the integration lane when PRs conflict.
