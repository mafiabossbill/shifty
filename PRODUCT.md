# PRODUCT.md — SHIFTY

> Product source of truth. From Bill's PRD/TRD v1.0 (25 Oct 2026) via [factory/BRIEF.md](factory/BRIEF.md) and
> [factory/PRODUCT_BLUEPRINT.md](factory/PRODUCT_BLUEPRINT.md) (machine view: `factory/blueprint.json`).
> Every PR that changes behaviour updates this file.

## One sentence
A person who works long, irregular shifts taps once to clock in and out, sees net time against a 16 h goal live, and gets
honest per-day reports and a companion (Mochi) that rewards healthy logging, instead of a spreadsheet or a generic timer.

## Vocabulary
| Term | Meaning |
| --- | --- |
| Session | One continuous shift from clock-in to clock-out. Never a calendar day; often crosses midnight. |
| Net worked | Elapsed − breaks, integer milliseconds. |
| Goal | Default 16 h net per session; editable per session and in Settings. A goal, not a limit. |
| Day allocation | Net split at local midnights of the session's reporting timezone (snapshotted at clock-in). |
| Device mode | Signed out or no Supabase configured: data only in this browser (IndexedDB), labelled "On this device". |
| Sync state | Local · Syncing · Synced · Needs attention (per event and summarised in the ribbon). |

## Users and roles
| Role | Who | Can (capabilities) | Home page | Signs in? |
| --- | --- | --- | --- | --- |
| admin | Bill (first confirmed sign-in of `ADMIN_EMAIL`) | shift:track, member:manage, settings:manage, audit:view | `/` | yes |
| member | Invited people, later | shift:track | `/` | yes (invite) |
| (device mode) | Anyone signed out | Everything, on this device only; no server access | `/` | no |

Everyone sees only their own tracking rows, admins included. `audit:view` covers org/membership audit only.
Template roles `manager` and `viewer` have no capabilities and are unused.

## Core rules (never break)
| Id | Rule | Enforced in | Test |
| --- | --- | --- | --- |
| R01 | One active session per user | database (partial unique index), api 409, ui | DB double-start; route 409; reducer |
| R02 | Day allocations sum exactly to net (integer ms), split at local midnights of the session's timezone, DST-safe | api + ui (one pure engine `src/lib/shifts/allocation.ts`) | fixtures A–O; property Σ = net |
| R03 | Every correction of start/end/timezone/breaks has a reason (3–500 chars) and writes a `session_revisions` row in the same transaction | database (`commit_shift_events()` + guard trigger), api 400, ui | route + DB tests |
| R04 | End after start; breaks inside their session, non-overlapping, one open at a time | database (CHECK, exclusion constraint, containment trigger), api, ui | reducer + DB tests |
| R05 | Location never moves the clock-in start; a failed capture is "not captured" with a reason, never a guessed position | database (CHECK outcome ⇔ position), api, ui | late-fix reducer test |
| R06 | Sync is idempotent and never silently overwrites: replay = original result; stale correction = 409 → Needs attention; purged sessions never come back | database (unique event id, tombstone), api, ui | replay / stale / post-purge route tests; e2e offline |
| R07 | A person sees and changes only their own rows | database (RLS `user_id = auth.uid()` + membership) | `scripts/check-rls.ts` member/admin/outsider cases |
| R08 | XP never grows with hours; capped per session and day; ledger deterministic and idempotent; corrections write reversals; unlocks and levels never removed | database (unique `(user_id, event_key)`), api | reward engine tests (8 h vs 20 h equal XP) |
| R09 | One person's sessions never overlap (trash excluded) | database (deferrable exclusion constraint), api 409, ui | route test naming the other session |
| R10 | Deleting a location fix removes its coordinates everywhere (row hard-deleted, event payload redacted) | database, api, ui | DB + device-log + export tests |

Acceptance anchors: Mon 18:00 → Tue 10:00 = 1 session, 16 h, Mon 6 h + Tue 10 h. With a Tue 02:00–02:30 break: 15 h 30 net, Mon 6 h + Tue 9 h 30.

## Entities
All tables carry `organization_id` + `user_id` (owner), composite FKs, timestamps, RLS. Account deletion removes all of a user's rows.

| Entity | Table | Key fields | Owner | Lifecycle / statuses | Deletion |
| --- | --- | --- | --- | --- | --- |
| Settings | `user_settings` | reporting_timezone, goal_net_ms, clock_format, week_start, theme, accent, allocation_mode, location_enabled, location_retention_days, reminders, safety limit, pay tracking + default rate/currency, haptics | user | one row per user | with account |
| Session | `shift_sessions` | device uuid, started_at, ended_at, reporting_timezone, goal_net_ms, source (live/manual/import), ended_by, project, place, tags, note, mood, energy, hourly_rate_minor + currency, net_ms/break_ms (derived), revision | user | active → completed → archived; trashed (`deleted_at`) | trash 30 days → user empties → hard delete + tombstone |
| Break | `shift_breaks` | device uuid, session_id, started_at, ended_at, kind | user | running → ended | with session |
| Location fix | `location_snapshots` | session_id, moment, outcome (captured/denied/timeout/unavailable), position, accuracy_m, captured_at, place_id | user | point-in-time | hard delete (user or retention) + redaction |
| Event | `shift_events` | id = device event id, session_id, type, payload, occurred_at, recorded_at, device_id, base_revision | user | append-only | with session purge (tombstone kept) |
| Revision | `session_revisions` | session_id, revision, reason, previous, updated, event_id | user | append-only | with session purge |
| Project | `work_projects` | name (unique per user), color | user | active → archived | archive |
| Saved place | `saved_places` | label, position, radius_m | user | — | hard delete |
| Reward entry | `reward_ledger_entries` | event_key (unique per user), kind, xp, session_id, rule_version | system (engine) | append-only, reversal rows | never (with account) |
| Achievement | `user_achievements` | achievement_key (unique per user), unlocked_at, session_id | system (engine) | unlocked, kept | never (with account) |
| Companion | `companion_states` | level (never decreases), xp_total, equipped, inventory, streak | system (engine) | cache of the ledger | with account |

Achievements: First Clock-In, Night Owl, Consistency Week, Break Champion, Data Keeper, First 100h Logged, Comeback.

## Flows
### F01 Track a shift (core)
1. Tap **Clock in**: start = tap time, written to the device event log at once; haptic + Mochi reaction.
2. Location asked in the background: captured, or "Location not captured" + reason (denied/timeout/unavailable) + Retry. Start never moves.
3. Optional: note, project, tags, place, pay rate.
4. Active hero: TOTAL ELAPSED vs NET WORKED (from absolute timestamps), goal ring capped at 100 % with overage shown separately, predicted finish, start date/time/zone. Active-session ribbon on every page.
5. Start / end breaks (ordered, non-overlapping).
6. Supportive rest prompts at 12 h, 14 h, 16 h+ (in-app; local notification while the app is open). No auto clock-out unless the safety limit is on.
7. Tap **Clock out**: end = tap time; 8 s undo.
8. Recap: net, breaks, days spanned with per-day split, XP, Mochi; optional note, mood, energy. Overage shown neutrally.

### F02 Offline and sync (core)
1. Every action is an event with a device uuid stored in IndexedDB (Local).
2. On app open, `online`, foreground, or **Sync now**: `POST /api/sync/events` sends the batch in order (Syncing).
3. Server re-runs the shared reducer and commits atomically through `commit_shift_events()` with revision checks (Synced).
4. A replay returns the original result. A correction against a stale revision returns 409 with the server state; the event shows **Needs attention**.
5. User keeps the server version or re-applies theirs as a new correction with a reason. Nothing is overwritten silently.
6. `GET /api/sync/state` pulls changes made on other devices.

### F03 Review and correct sessions (core)
1. `/sessions`: timeline cards; filter by date, tag, project, place, length; search notes; Needs attention filter.
2. Session detail: one timeline across midnight, per-day contributions, breaks, location fixes, revision history.
3. Edit start/end/breaks → reason → preview new per-day split → save.
4. Revision recorded; reports and XP recompute (reversal rows when XP no longer applies).

### F04 Manual session
`/sessions/new` → start, end, breaks, timezone, note → overlap check (R09) → saved, labelled Manual.

### F05 Insights
| Item | Detail |
| --- | --- |
| Ranges | today / week / month / year / custom / session |
| Modes | "Allocate to calendar days" · "Group by session start date" |
| Charts | hours-in-motion ring, day-split ribbon, 7/30/90-day heatmap, weekly bars with break + target overlays, month calendar with origin-session links, clock-in time-of-day distribution, duration distribution (mean/median), records, month-on-month deltas, location breakdown (opt-in), earnings (pay tracking on) |
| Every chart | empty/loading/error, both themes, text alternative, tooltips, drill-down to sessions |
| Share | recap image/text never includes location |

### F06 Companion and rewards
| Item | Detail |
| --- | --- |
| Mochi | Original star-blob; poses happy/focused/sleepy/resting/celebrating; habitat |
| XP | Logging, completing, healthy breaks, routines, weekly review; capped; never proportional to long hours |
| Progress | Levels; unlockable palettes, hats, decor, backgrounds; forgiving streaks with rest days and freezes |

### F07 Data and privacy
1. `/settings/data`: export CSV and JSON (UTC instants, reporting tz, allocations, audit); printable report; import (SHIFTY JSON or CSV) with dry run and per-row errors.
2. `/settings/privacy`: location on/off, retention (30/90/365 days/keep), see and delete fixes, saved places.
3. `/settings/account`: download my data, delete my account.

### F08 Trash
Delete → trash (30 days) → restore, or empty trash (hard delete + tombstone; rewards recompute).

### F09 Device mode → account
Use signed out ("On this device") → sign up / sign in → offered to upload this device's sessions (nothing uploads without a tap)
→ Synced. Sign out warns with the unsynced count, then clears device data.

## Screens
Phone bottom nav: Home · Sessions · Insights · Companion · Settings. "Device mode" screens also work signed out, from IndexedDB only.

| Route | Purpose | Roles | Primary action | Phone layout |
| --- | --- | --- | --- | --- |
| `/` | Greeting + Mochi, Clock in / active hero, goal ring, last session, week sparkline | all + device mode | Clock in / Clock out | dashboard |
| `/sessions` | History, filters, search, Needs attention | all + device mode | Add session | cards |
| `/sessions/[id]` | Timeline, per-day split, breaks, fixes, revisions, edit, conflicts | all + device mode | Edit | detail |
| `/sessions/new` | Manual entry | all + device mode | Save session | form |
| `/sessions/trash` | Restore or empty | all + device mode | Restore | cards |
| `/insights` | Charts and reports | all + device mode | — | dashboard |
| `/companion` | Mochi, level, achievements, wardrobe | all + device mode | Equip | cards |
| `/settings` | Preferences, sync status | all + device mode | — | form |
| `/settings/privacy` | Location, retention, saved places | all + device mode | Delete location history | form |
| `/settings/data` | Export, print, import, upload device data | all + device mode | Export | form |
| `/settings/account` | Profile, password, my data, delete account | admin, member | Save | form |
| `/settings/team` | Invite, role, deactivate (template) | admin | Invite | cards |
| `/login`, `/signup` | Auth | public | Sign in / Sign up | public |
| `/privacy`, `/terms`, `/cookies`, `/data-deletion` | Legal | public | — | public |

## Notifications and messages
| Event | Who | Channel | When |
| --- | --- | --- | --- |
| Rest prompt | the worker | in-app + local notification (app open/recent) + badge where supported | 12 h, 14 h, 16 h+ net |
| Safety limit reached | the worker | in-app | when the opt-in limit ends a session |
| Clock-out recap | the worker | in-app | after clock-out |
| Achievement / level up | the worker | in-app (Mochi celebrates) | on unlock |
| Needs attention | the worker | in-app, persistent until resolved | sync conflict or refusal |

Not equivalent to iOS Live Activities (a PWA can't create them); phase 3 = SwiftUI/ActivityKit spec only.

## Integrations
| Provider | Purpose | Direction | Credentials (names) | Status |
| --- | --- | --- | --- | --- |
| Supabase (platform, not an integration) | Auth + sync storage | — | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL` | not created (A01): device mode |
| None in phase 1 | No reverse geocoding (A05), no server push (A06), no payments, no email beyond auth | — | — | — |

## Scheduled jobs
None. Trash age, location retention and the safety limit are applied deterministically on app open and on sync.

## Non-functional
| Topic | Requirement |
| --- | --- |
| Locale | Default timezone Africa/Dar_es_Salaam (reporting tz = device tz at first launch, A03); TZS, 0 decimals (`TSh 1,250,000`), user-changeable pay currency; English; week starts Monday; 12/24 h |
| Devices | Installed iPhone PWA first; Android and desktop (insights) supported; 375/430/tablet/desktop, light and dark |
| Offline | offline-queue: F01–F04, F06, F08 and settings work offline; sync on open/online/foreground/manual; Background Sync only where supported |
| Time | Timers from absolute timestamps, never tick counting; instants stored UTC; days derived in the session's IANA zone |
| Integrity | Integer ms everywhere; reducer, allocation and reward engines are pure (take `now`) and shared by device and server |
| Data volume | Year one per user: ~700 sessions, ~10k events, ≤3 location fixes per session |
| Retention / deletion | Trash 30 days; location default 90 days, hard delete + redaction; account deletion removes everything |
| Privacy | Location opt-in, point-in-time only, never sent to a third party, never in shared recaps; listed in export and privacy pages |
| Accessibility | WCAG AA, reduced motion respected, text alternative for every chart, 44 px targets |
| Look | Premium and joyful: deep ink/navy dark, cream light, lilac/indigo accent `#6d5dfc`, sage/teal success, warm orange celebration, big numbers |

## Out of scope (for now)
- [ ] Team scheduling, rosters, employer monitoring, views of other people's shifts
- [ ] Payroll compliance, overtime law, invoices, payments
- [ ] Continuous GPS, geofencing, spoof detection, reverse geocoding
- [ ] Leaderboards, social features, AI coaching
- [ ] Native iOS app, Live Activities, Apple Watch (phase 3 = written spec only)
- [ ] Server Web Push and scheduled jobs (A06)
- [ ] PDF generation (print stylesheet instead), custom domain

## Assumptions
| Id | Assumption | Status |
| --- | --- | --- |
| A01 | SHIFTY never writes to the pasuax-executive-matrix Supabase project; device mode until SHIFTY's own project variables are set (credential needed from Bill) | assumed |
| A02 | Company tenancy, one org, Bill first admin via `ADMIN_EMAIL`; own rows only, admins included | assumed |
| A03 | Reporting tz = device tz at first launch (fallback Africa/Dar_es_Salaam); snapshotted per session | assumed |
| A04 | Pay tracking off by default; hourly rate per session in minor units, TZS default; no overtime law | assumed |
| A05 | No reverse geocoding; place labels from saved places matched on the device | assumed |
| A06 | Reminders in-app and local while the app is open; server Web Push deferred | assumed |
| A07 | Rewards are a pure function of history, reconciled with reversal rows; unlocks and levels kept | assumed |
| A08 | Clock-out undo grace 8 s; end = tap time | assumed |
| A09 | Trash keeps sessions 30 days; the user empties it; no purge job | assumed |
| A10 | One person's sessions never overlap; overlapping entries/imports/corrections refused | assumed |
| A11 | Safety limit off by default; when on (20 h) the session ends at start + limit, labelled, applied deterministically | assumed |
| A12 | Location retention default 90 days (30/90/365/keep) | assumed |
| A13 | Signing in from device mode offers to upload local sessions; nothing uploads without a tap | assumed |
| A14 | Sign-out warns with the unsynced count, then clears device data | assumed |
| A15 | Events dated > 10 min ahead of server time are refused ("Check your device clock") | assumed |
| A16 | Earnings = round half-up(net_ms × rate_minor / 3,600,000) in the session currency | assumed |
| A17 | Import: SHIFTY JSON (lossless) and documented CSV; rows labelled Import | assumed |
| A18 | Phase 3 iOS Live Activities = written spec only | assumed |
