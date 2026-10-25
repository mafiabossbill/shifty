# STATE — SHIFTY

> Shared memory for every session and agent working on `shifty`. The orchestrator owns this file;
> other agents append only to **Log** and their own row in **Agents**. Update it in the same commit as the work.
> Format reference: factory `factory/STATE.md`. Keep it short: facts, not narrative.

## Snapshot
| Field | Value |
| --- | --- |
| Phase | 0 — Understand (see `workflows/new-app.md` phases 0–17) |
| Blueprint | `factory/blueprint.json` (validated: no) |
| Production URL | — (not deployed) |
| Preview URL | — |
| Supabase project | dev: — · prod: — (refs only, never keys) |
| Release owner | release-engineer |
| Last green check | — (commit, `npm run check:full`) |

## Agents (current assignments)
| Agent | Task ids | Branch | Status | Last handoff |
| --- | --- | --- | --- | --- |

## Blockers (real ones only: credentials, decisions only Bill can make, external approvals)
| Since | Blocker | Needed from | Exactly what is needed |
| --- | --- | --- | --- |

## Credentials status (names only, NEVER values)
| Variable / account | Development | Preview | Production | Where it lives |
| --- | --- | --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL / ANON_KEY | — | — | — | Vercel env / cloud env settings |
| SUPABASE_SERVICE_ROLE_KEY | — | — | — | Vercel env only |

## Verified (only things checked with evidence)
| Date | What | Evidence (command, URL, commit) |
| --- | --- | --- |

## Log
<!-- newest first: YYYY-MM-DD agent — one line -->
