# Rewards engine (`src/lib/rewards`)

Pure, deterministic, idempotent. XP rewards healthy, honest logging — never hours. Input is the whole
session history (deleted sessions included), activities, settings, `today`, `now` (running session only)
and the persisted achievements. Same input → same output on every device.

## Use
```ts
const r = computeRewards({ sessions, activities, settings, today, now, earned: profile.achievements, highestLevel: companion.highestLevel });
profile.ledger.push(...reconcileLedger(profile.ledger, r.targets));
profile.achievements.push(...r.newAchievements.map(({ code, earnedAt, sourceSessionId }) => ({ code, earnedAt, sourceSessionId })));
companion.highestLevel = r.level;
// Persist r.rhythm.frozenDates not yet recorded as `streak_freeze_used` activities (key = date).
```

## Rules
| Key | XP | When | `at` |
| --- | --- | --- | --- |
| `complete:<sessionId>` | 20 | Completed, net ≥ 30 min, among the first 2 such sessions (by start) of its anchor date | session end |
| `live:<sessionId>` | 5 | Same session, origin `timer` (corrections keep it) | session end |
| `break:<sessionId>` | 10 | Same session, a break ≥ 10 min (net ≥ 4h) or ≥ 5 min (net < 4h) | session end |
| `day:<date>` | 5 | Anchor date with a counted session (net ≥ 30 min); owned by its first awarded session | that session's end |
| `rest:<date>` | 5 | Unplanned weekday, after the first session and before today, nobody clocked in, a counted day in the 7 days before, ≤ 2 per week | end of that day (settings zone) |
| `review:<weekStart>` | 15 | A `week_review` activity; key normalised to the week start; weeks from the first session up to today | earliest review of that week |
| `achievement:<code>` | 25–60 | Once, sticky | earned instant |

Anchor date = local date of the start in the session's reporting zone. Archived sessions count; deleted ones don't.
Per-session XP is capped at 40 (+ one-time achievements); a 20h session earns exactly what an 8h one does.

## Achievements
| Code | XP | Earned when | `earnedAt` |
| --- | --- | --- | --- |
| `first_clock_in` | 25 | First timer session (running counts) | its start |
| `night_owl` | 30 | Counted session touching ≥ 2 local dates | its end |
| `consistency_week` | 40 | 5 distinct counted anchor dates in one week (`settings.weekStart`) | end of the session making the 5th |
| `break_champion` | 40 | 10 `break:` awards | 10th award |
| `data_keeper` | 25 | An `export` activity | activity |
| `first_100h` | 60 | Σ net of completed sessions ≥ 100h (a total, not a long shift) | end of the crossing session |
| `comeback` | 30 | A session starting ≥ 7 days after the previous end | its start (the welcome-back moment) |
| `early_bird` | 25 | Counted session started 05:00–07:59 local | its end |
| `weekly_reviewer` | 40 | 4 `review:` awards | 4th review |
| `rest_respecter` | 40 | 8 `rest:` awards | end of the 8th rest day |

Persisted achievements stay (with their original instant and XP) even if the session behind them is
edited or deleted. Unknown codes in `earned` (newer app version) are ignored here, not removed.

## Ledger
Rows are `<base>#<n>`, append-only. For each target, `delta = target.xp − Σ rows(base)`; non-zero → one row
`#<max n + 1>` (`rule` = target rule, or `reversal` when negative). A base in the ledger with no target is
reversed to 0. Running twice appends nothing.

Deterministic `at` (no `now` parameter): positive rows use the target instant; reversals of a session's
keys use **tombstone targets** (`xp: 0`, dated at the session's `deletedAt ?? updatedAt`, i.e. the
deleting/correcting event); a base with no target at all (e.g. a rest day that no longer qualifies) is
reversed at the latest `at` among its rows. Achievement keys are never reversed. Keys with an unknown
prefix (`future:…`) are never touched, so two app versions don't fight.

## Levels
Reaching level n takes `25·n·(n−1)` XP (level n → n+1 spans `50·n`). Regular user (5 sessions/week with
breaks, weekends off, weekly review ≈ 225 XP/week + achievements): level 5 on day 14, level 10 in week 9
(test proves both). Displayed level = max(XP level, `highestLevel`): it never decreases.

## Rhythm (forgiving streak)
Walk from the first work date to yesterday (+ today if logged). Planned day with work +1; unplanned day
neutral (working on it adds nothing — no reward for skipping rest); missed planned day spends a freeze, or
is honoured if listed in `freezesUsed`, else the rhythm starts again at 0 (best kept). Freeze earned every
7th counted day of a run, max 2 held. Today is `logged`, `pending` (never breaks) or `rest`. A running
session keeps its anchor date logged (a night shift doesn't drop yesterday at midnight).

## Refinements of the spec (and why)
| Change | Reason |
| --- | --- |
| `live:` and `break:` only for sessions that earned `complete:` | Otherwise many short sessions farm 5/10 XP each |
| Short-session break ≥ 5 min instead of "any break" | A one-second tap isn't a break |
| Rest days need a counted day in the previous 7 days, ≤ 2/week | Time away or `plannedWeekdays = []` would pay XP for nothing |
| Reviews normalised to the week start, only weeks from the first session to today | One per real week; no reviewing empty history |
| Level step 50 instead of 60 | Hits "level 5 in ~2 weeks, 10 in ~2 months" for the regular-user simulation |
| `first_clock_in` / `comeback` dated at the session start | They celebrate arriving, which happens at clock-in |
| `reconcileLedger(existing, targets)` has no `now` | Every instant is derivable from history (see Ledger) |
