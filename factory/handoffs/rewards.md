### 2026-10-25 backend-engineer — rewards engine
AGENT: backend-engineer
TASK: rewards — SHIFTY rewards engine (pure, deterministic, idempotent, edit-resilient)
FILES CHANGED: src/lib/rewards/{index,types,rules,achievements,ledger,levels,rhythm}.ts, src/lib/rewards/README.md, tests/rewards.test.ts, tests/rewards-rhythm.test.ts, factory/handoffs/rewards.md
WHAT WAS IMPLEMENTED:
- `computeRewards(input)` → targets, totalXp, level (never below `highestLevel`), progress, achievements (+ new), rhythm, xpBySession, `summaryForSession(id)` with recap lines and plain notes (cap / under 30 min).
- XP rules: complete 20 (net ≥ 30 min, 2 per anchor date), live 5 (timer), break 10 (≥10 min if net ≥ 4h, ≥5 min otherwise), day 5, rest 5, review 15, achievements 25–60. Per-session max 40: a 20h session earns exactly what an 8h one does (tested, plus a 4h…30h sweep).
- 10 sticky achievements with warm copy (`ACHIEVEMENTS`), earliest qualifying instant, persisted ones never removed.
- `reconcileLedger(existing, targets)`: append-only `<base>#<n>` rows, delta to target, reversals for vanished keys; twice = nothing; two devices = identical rows; achievement keys never reversed; unknown prefixes untouched.
- `rhythm(...)`: forgiving streak over planned weekdays, rest days neutral, pending today never breaks it, freezes 1 per 7 counted days (max 2), already-shown freezes honoured.
IMPORTANT DECISIONS:
- No `now` in `reconcileLedger`: positive rows dated at the target instant; reversals of session keys dated by xp-0 tombstone targets at `deletedAt ?? updatedAt` (the deleting/correcting event); target-less bases reversed at their latest row's `at`. Fully deterministic.
- `live:`/`break:` only for sessions that earned `complete:` (anti-farming); short-session break ≥ 5 min instead of "any".
- Rest days need a counted day in the previous 7 days and are capped at 2/week (otherwise time away or `plannedWeekdays = []` pays XP).
- Reviews normalised to `startOfWeek(key, weekStart)`; only weeks from the first session to today.
- Level n needs 25·n·(n−1) XP (step 50): simulated regular user hits level 5 on day 14 and 10 in week 9 (tested).
- `first_clock_in` and `comeback` dated at the session start (they celebrate the clock-in); others at the session end / activity.
- Ledger `rule` values = blueprint `reward_ledger_entries.kind` enum (`session_completed`, `session_logged`, `healthy_break`, `routine`, `weekly_review`, `achievement`, `reversal`).
- Details and all numbers: src/lib/rewards/README.md.
DEPENDENCIES: read-only use of src/lib/shifts/{types,profile,events,reducer}.ts and src/lib/time/{allocate,zone}.ts (unchanged).
KNOWN RISKS:
- Changing `plannedWeekdays`, `weekStart` or rezoning a session re-evaluates past rest/review/day keys and appends reversal + new rows (levels/items still never drop). UI should not present these as "lost".
- A rule change in a future version (different XP values) appends adjustment rows; two devices on different versions would append opposing rows for known keys. Roll rule changes out together (blueprint has `rule_version`; not modelled here).
- If the caller forgets to pass `earned`, achievement XP whose session was deleted disappears from `totalXp` (the ledger keeps it — achievement keys are never reversed). Always pass `profile.achievements`.
- Tombstone dates use `updatedAt` (device `recordedAt`): a skewed device clock skews reversal `at`, deterministically.
- `ledgerEntrySchema.sourceSessionId` is `z.uuid()`; session ids from `crypto.randomUUID()` pass (tested with schema parse).
TESTS RUN: `npx vitest run`, `npm run lint`, `npm run typecheck` in /home/user/lanes/rewards
TEST RESULTS: vitest 19 files / 129 tests passed (35 new: tests/rewards.test.ts 27, tests/rewards-rhythm.test.ts 8); lint clean; typecheck clean.
NEXT AGENT ACTION: frontend-engineer — call `computeRewards` after every state change, persist `reconcileLedger` rows + `newAchievements` + `highestLevel = level` + new `rhythm.frozenDates` as `streak_freeze_used` activities; render `summaryForSession` in the clock-out recap. database-engineer — `reward_ledger_entries.event_key` unique holds `<base>#<n>`; `kind` = row `rule`.
COMMIT: c36fca5 on lane/rewards (not pushed; this handoff in the following docs commit)
