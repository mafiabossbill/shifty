# HANDOFFS — SHIFTY

> Every agent ends every task with one entry here (newest first) and in its final message/PR body.
> The next agent starts by reading the latest entries that name it. Never claim a test ran if it didn't.

## Format (copy exactly)
```
### <YYYY-MM-DD> <AGENT> — <TASK id + title>
AGENT: <agent name>
TASK: <id> <title>
FILES CHANGED: <paths or globs>
WHAT WAS IMPLEMENTED: <2–5 bullets, user-visible behaviour first>
IMPORTANT DECISIONS: <decision → why; link factory/DECISIONS.md entry if architectural>
DEPENDENCIES: <tasks/agents this relied on; anything still assumed>
KNOWN RISKS: <what could break; what is untested; "none" only if true>
TESTS RUN: <exact commands>
TEST RESULTS: <pass/fail counts, or "not run: <reason>">
NEXT AGENT ACTION: <agent> — <what they must do next>
COMMIT: <sha> on <branch> (PR <link> if any)
```

## Entries
