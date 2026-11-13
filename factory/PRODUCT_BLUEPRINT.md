# Product blueprint — SHIFTY

> Phase 1 output (product-architect). The machine-readable block at the end is the source
> (`node tools/blueprint-from-md.mjs` → `blueprint.json`, validated by `node tools/validate-blueprints.mjs`).
> Brief and assumptions A01–A09: [BRIEF.md](BRIEF.md). Product truth for builders: [PRODUCT.md](../PRODUCT.md).

## 1. Product
| Field | Value |
| --- | --- |
| One-liner | A person who works long, irregular shifts taps once to clock in and out, sees net time against a 16h goal live, and gets honest per-day reports and a companion that rewards healthy logging, instead of a spreadsheet or a generic timer |
| Users | Bill (1, admin) now; invited members later · iPhone installed PWA first, desktop for insights · network variable, often offline mid-shift |
| Core loop | Clock in (one tap, start = tap time) → live elapsed vs net, breaks → clock out (8 s undo) → recap → sessions sync across devices → per-day split and insights |
| First release scope | F01–F09 (track, offline sync, history + corrections, manual entry, insights, companion, data + privacy, trash, device mode → account) |
| Definition of live | Vercel production URL (`*.vercel.app`) on SHIFTY's own Supabase project (A01); Bill signed in as admin; one real shift crossing midnight tracked on the installed iPhone PWA, synced, visible on desktop with the correct per-day split |

## 2. Roles
| Role | Capabilities | Home | Signs in |
| --- | --- | --- | --- |
| admin | shift:track, member:manage, settings:manage, audit:view | `/` | yes (first confirmed sign-in of `ADMIN_EMAIL`) |
| member | shift:track | `/` | yes (invite) |
| (device mode) | none on the server; everything in this browser's IndexedDB, labelled "On this device" | `/` | no |

| Note | Detail |
| --- | --- |
| Own rows only | Every tracking row has `organization_id` **and** `user_id`; RLS = `user_id = auth.uid()` and org membership. Admins never see members' shifts (R07). |
| `audit:view` | Covers the template's org/membership `audit_logs` only, never another person's tracking rows. |
| Template roles | `manager`, `viewer` exist in the template map with no capabilities; unused by SHIFTY. |

## 3. Entities and rules
All tables: `organization_id` + `user_id` (owner), composite FKs `(organization_id, id)`, `created_at`/`updated_at`, RLS in the creating migration.
Account deletion (`delete_own_account()`) removes every row below for that user.

| Entity | Table | Tenant | Deletion | Audit | Key fields |
| --- | --- | --- | --- | --- | --- |
| Settings | `user_settings` | yes | never (one row per user) | via `shift_events` | reporting_timezone, goal_net_ms (57,600,000), clock_format, week_start, theme, accent, allocation_mode, location_enabled, location_retention_days, reminders, safety_limit_enabled/hours, pay_tracking_enabled, default_hourly_rate_minor, pay_currency, haptics_enabled |
| Session | `shift_sessions` | yes | trash (`deleted_at`) → user empties → hard delete + tombstone | yes | id (device uuid), started_at, ended_at, reporting_timezone (snapshot), goal_net_ms, source (live/manual/import), ended_by, project_id, place_id, tags, note, mood, energy, hourly_rate_minor + pay_currency, net_ms/break_ms (derived), revision, archived_at |
| Break | `shift_breaks` | yes | with session | yes | id (device uuid), session_id, started_at, ended_at, kind |
| Location fix | `location_snapshots` | yes | **hard** (privacy) | yes (event, coordinates redacted on delete) | session_id, moment (clock_in/clock_out/retry), outcome (captured/denied/timeout/unavailable), position, accuracy_m, captured_at, place_id |
| Event | `shift_events` | yes | never individually; goes with session purge (tombstone kept) | is the log | id = device_event_id (unique), session_id, type, payload, occurred_at (device), recorded_at (server), device_id, base_revision |
| Revision | `session_revisions` | yes | never individually; goes with session purge | is the audit | session_id, revision, reason, previous, updated, event_id |
| Project | `work_projects` | yes | archive | no | name, color, archived_at |
| Saved place | `saved_places` | yes | hard | no | label, position, radius_m |
| Reward entry | `reward_ledger_entries` | yes | never (reversal rows) | is the ledger | event_key (unique per user), kind, xp, session_id, rule_version |
| Achievement | `user_achievements` | yes | never (A07) | no | achievement_key (unique per user), unlocked_at, session_id |
| Companion | `companion_states` | yes | never (one row per user, cache) | no | level, xp_total, equipped, inventory, streak |

| Rule | Statement | Enforced in | Test |
| --- | --- | --- | --- |
| R01 | One active session per user: a second clock-in while one is open is refused and the open one is shown | database, api, ui | partial unique index `shift_sessions (user_id) where ended_at is null and deleted_at is null`; DB test double start fails; sync route 409; reducer test |
| R02 | Calendar days are derived: net time splits at local midnights of the session's `reporting_timezone`; Σ day allocations = net exactly (integer ms); DST-safe (23/25 h days) | api, ui | pure engine `src/lib/shifts/allocation.ts` used by client and server; fixtures A–O (TRD §3.6) + property test Σ = net; Mon 18:00→Tue 10:00 = Mon 6 h + Tue 10 h; with Tue 02:00–02:30 break = Mon 6 h + Tue 9 h 30 |
| R03 | Every correction of start, end, timezone or breaks carries a reason and writes a `session_revisions` row (previous + updated) in the same transaction | database, api, ui | `commit_shift_events()` refuses a correction without reason (3–500 chars); guard trigger refuses direct updates of started_at/ended_at outside the function; route test 400; DB test revision row exists |
| R04 | `ended_at > started_at` on sessions and breaks; breaks stay inside their session and never overlap; one open break per session | database, api, ui | CHECKs; exclusion constraint `(session_id, tstzrange(started_at, ended_at)) &&` (btree_gist); constraint trigger for containment; reducer tests |
| R05 | Location is a separate point-in-time fact: it never moves the clock-in start; a failed capture is stored as not captured with its reason, never a guessed position | database, api, ui | CHECK `outcome = 'captured'` ⇔ position present; commit function never writes started_at from a location event; reducer test: fix arriving 40 s late leaves start unchanged |
| R06 | Sync is idempotent and never silently overwrites: a replayed event id returns the original result; a correction based on a stale revision is 409 with the server state and stays on the device as Needs attention; events for a purged session are ignored | database, api, ui | unique `shift_events (id)`; route tests: replay = 200 same result, stale base_revision = 409, replay after purge does not resurrect; e2e offline replay |
| R07 | A person sees and changes only their own tracking rows (admins included) | database | `scripts/check-rls.ts`: second member and admin see 0 rows of the first member on every tracking table; outsider sees nothing |
| R08 | XP never grows with hours worked; per-session and per-day caps; the ledger is a deterministic, idempotent function of history; corrections write reversal rows; unlocked items and levels are never taken away | database, api | unique `(user_id, event_key)`; reward engine tests: 8 h and 20 h sessions earn the same completion XP; recompute twice = no new rows; correction → reversal row; level never decreases |
| R09 | No unintentional overlap: clock-in, manual entry, import, restore and corrections that would overlap another session are refused naming it, unless the person explicitly confirms the overlap (allowOverlap) | database, api, ui | reducer findOverlap (shared device + server); reducer and route tests 409 |
| R10 | Deleting a location fix removes its coordinates everywhere: the snapshot row is hard-deleted and the originating event's payload is redacted (the only permitted change to an event); exports afterwards contain none | database, api, ui | DB test: after `location_deleted`, no row and no coordinates in `shift_events.payload`; device log redacted; export test |

## 4. Flows and screens
| Flow | Steps | Roles | Core |
| --- | --- | --- | --- |
| F01 Track a shift | Clock in (start = tap time, saved to the device log at once) → location asked in the background (captured, or "Location not captured" + reason + Retry) → optional note, project, tags, place, rate → active hero (elapsed vs net, ring capped at 100 % + overage, predicted finish, start date/time/zone, ribbon on every page) → breaks → rest prompts 12/14/16 h+ → Clock out (end = tap time, 8 s undo) → recap (net, breaks, per-day split, XP, Mochi, mood/energy/note) | admin, member | yes |
| F02 Offline and sync | Every action = event with device uuid in IndexedDB (Local) → on app open / online / foreground / Sync now → `POST /api/sync/events` in order (Syncing) → server re-runs the reducer, `commit_shift_events()` commits atomically (Synced) → replays return the original; stale revision → 409, event shows Needs attention → user keeps the server version or re-applies theirs as a new correction with a reason → `GET /api/sync/state` pulls other devices | admin, member | yes |
| F03 Review and correct | `/sessions` timeline cards, filter (date, tag, project, place, length), search notes → open session: one timeline across midnight, per-day contributions, breaks, fixes, revisions → edit start/end/breaks → reason → preview new split → save → reports and XP recompute | admin, member | yes |
| F04 Manual session | `/sessions/new` → start, end, breaks, timezone, note → overlap check (R09) → saved labelled Manual | admin, member | no |
| F05 Insights | `/insights` → range tab (today/week/month/year/custom/session) → allocation mode (allocate to days / group by start date) → chart → tooltip / text alternative → drill down to sessions → share recap (no location) | admin, member | no |
| F06 Companion | `/companion` → Mochi pose + habitat, level, XP log, achievements, forgiving streak (rest days, freezes) → equip unlocked palette/hat/decor/background | admin, member | no |
| F07 Data and privacy | `/settings/data` export CSV/JSON (UTC instants, tz, allocations, audit), printable report, import with dry run + per-row errors → `/settings/privacy` location on/off, retention, see/delete fixes, saved places → `/settings/account` download my data, delete account | admin, member | no |
| F08 Trash | Delete session → trash (30 days, A09) → restore, or empty trash (hard delete + tombstone, rewards recompute) | admin, member | no |
| F09 Device mode → account | Use signed out ("On this device") → sign up / sign in → offered to upload this device's sessions (replay of the log; nothing uploads without a tap) → Synced · sign out warns with the count of unsynced changes, then clears device data | admin, member | no |

### Screens
Screen plans (UI standard §2.1), written by lane R0 of the redesign (`factory/REDESIGN.md`, 2026-11-13) from what each screen does today.
The redesign is look only (R-D1): every block, action, URL and piece of copy listed here exists today and stays; a plan settles what
ranks first and what it is built from. Each lane builds its screens from its plans and shows every listed state in the gallery.

Device mode = signed out or Supabase not configured: every screen below renders from IndexedDB only; no server data is ever public.

| Route | Lane | Type | Primary action (the one solid button) |
| --- | --- | --- | --- |
| `/` | R1 | Do | Clock in · Clock out while working · End break while on a break |
| `/sessions` | R2 | Overview | Add missed session |
| `/sessions/view?id=` | R2 | Focus | None at rest (Edit times is an outline) · Restore when the session is in the trash |
| `/sessions/new` | R2 | Make | Add session |
| `/sessions/trash` | R2 | Overview | None |
| `/insights` (and `?session=`) | R3 | Overview | None |
| `/companion` | R4 | Overview | None (a tap on an item wears it at once) |
| `/settings` | R5 | Overview | None |
| `/settings/sessions`, `/appearance`, `/pay`, `/privacy` | R5 | Make (preferences) | None (each control saves on change) |
| `/settings/places` | R5 | Make | Save place, inside the new-place form |
| `/settings/device` | R5 | Focus | Install SHIFTY, only when the browser offers it |
| `/settings/data` | R5 | Do | Add N sessions, inside the import preview |
| `/settings/account` | R5 | Do | Sign in when signed out · Upload this device's data when it is waiting |
| `/dashboard` | R1 | — | A redirect to `/`; it draws nothing |
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/onboarding`, `/no-access`, legal pages | R0 | Focus / reading | Built in lane R0; shown at `/design/auth/*`, `/login`, `/privacy`, `/cookies`, `/no-access` |

#### Rules every plan shares
| Topic | Rule |
| --- | --- |
| Title | The top bar names the place on every width. `PageHeader` keeps the `<h1>` for screen readers and shows only a description and actions. A sub-page (a settings page, Add session, Trash) shows a back link and its own title in `text-title` |
| Numbers | The largest number on any screen is `text-display` (28px), `font-semibold tabular-nums`. The live timer too. No bigger size exists |
| Labels | A label above a figure is `text-caption text-muted-foreground`, sentence case. No capital-letter labels, no wide letter spacing |
| Boxes | One `Card` around a distinct object (a session, the habitat). A list is rows divided by lines inside one region. Figures (`StatTile`) have no box. Never a box in a box |
| Colour | Greys. Status only through the tone map (`Pill`): Clocked in and Syncing `info`, On break and Needs attention `warning`, Completed and Synced `success`, a problem `danger`. More hours is never good or bad: hours and overage stay grey. Violet only in the logo and in Mochi's drawing |
| Charts | Bars and bands in greys (one darker step for today or the selected mark), the goal as a dashed line, exact values on hover or tap, a legend beside, a table alternative, an empty sentence. No ring, no radial chart, no glow. `ProgressBar` for progress toward a goal, with the figures in words beside it |
| Actions | One solid button a screen at most. Delete, discard, erase and sign-out are outline or link buttons until the confirm step, where the red button names the thing ("Delete session") |
| Fields | `Field`: label above, hint and error between label and control. Preferences save on change; text fields save on blur or Enter and say "Saved" |
| States | Loading is a skeleton of the real layout. Empty is `EmptyState`: what will appear and the first action. An action's error is a sentence next to where it happened or a toast with the sentence the store returns |
| Motion | Under 300ms, only on what changes. Nothing pulses: a live session is told by its pill and its running clock |
| Mochi | The drawing keeps its colours (R-D4). Everything around it (name, speech, level, tiles) follows the system |

#### `/` Home (R1)
| Field | Plan |
| --- | --- |
| Purpose | Start or end a shift with one tap, and see net time against the goal right now |
| Who arrives | The worker at the start, during and at the end of a shift: from the home-screen icon, the ribbon on another page, or a `?action=clock-in` shortcut. They know whether they are working |
| Type | Do |
| Primary action | Idle: **Clock in**. Working: **Clock out** (8s undo, no confirm). On a break: **End break**, and Clock out drops to outline. The other action (Start a break) is outline. `lg` size, full width on phones |
| Content 1 | Idle: the Clock in button with "Goal 16h net · {zone}" under it. Working: the state pill and "Started {time}", net worked as the one `text-display` number with seconds, a `ProgressBar` to the goal and the words "of 16h goal · 6h 48m to go" or "Goal 16h · +1h 12m past it" |
| Content 2 | Working: total elapsed, breaks, "Goal at {time}", the crossed-midnight split, the location line with Try again, rest nudges. Idle: Add details (title, project, tags, note), the last session (one linked row), this week (net, days worked, breaks, seven small bars) |
| Content 3 | The greeting with a small Mochi and her line; the rhythm summary linking to Companion; "Try the demo" on first run |
| Pattern | Home [P]: what is happening now, then figures that link to their rows. No hero box: the session block sits on the page; Last session is one interactive `Card`; This week is `StatTile`s and bars with no box |
| States | Loading · first run (no sessions: one column, one sentence, the demo link) · idle · `?action=clock-in` prompt with "Not now" · working · on a break · over the goal · crossed midnight · location pending, captured, not captured, none after 90s · nudge shown · storage blocked · long title · demo banner · recap sheet with and without undo left |
| Phone | One column: state, number, bar, actions within thumb reach, then details. From 1024px two columns: the session on the left, last session, week and rhythm on the right |
| Next step | Clock in: the screen turns to the working state. Clock out: the recap sheet (net, per-day split, breaks, XP as a list, optional mood, energy and note; **Done** or **Save and close** solid, Undo clock-out outline), then Home idle with the last session |
| Must change | The ring, its halo and the round CLOCK IN go: a flat solid button and a bar. The 64 to 88px timer becomes `text-display`. Capital eyebrows become captions. The hero card and the side cards lose their boxes and glow. Nudges are a sentence with a dismiss button, not tinted cards. The XP box in the recap becomes a plain list |

Shell parts owned by R1: the **sync pill** opens the sync sheet (state pill, explanation, last synced, **Sync now** solid, Needs attention rows with Retry outline and Discard link → confirm); the **active ribbon** is one flat line ("Working · 9:12:04 net") linking to Home, no pulsing dot; the **demo banner** is one quiet line with Exit demo as a link.

#### `/sessions` Sessions (R2)
| Field | Plan |
| --- | --- |
| Purpose | Find a shift and open it |
| Who arrives | The worker checking or fixing a past shift: from the nav, Home's last session, or a number tapped in Insights (`?ids=`, `?date=`) |
| Type | Overview |
| Primary action | **Add missed session**. Trash (n) is a ghost link beside it |
| Content 1 | The rows, grouped by date: title (semibold), net (right-aligned, tabular), "18:00 → 10:00 +1" |
| Content 2 | Search, sort, Filters (count), the count line "56 sessions · 672h 40m net"; per row: breaks, the day-split bar, state and origin pills, place |
| Content 3 | Drill-down chip from Insights, active filter chips, "Show n more" |
| Pattern | Table on desktop (`table-fixed`: Session gives way, Time, Day split, Breaks and Net never wrap), stacked rows on phones, in one region divided by lines. Filters in a sheet, applied at once, kept in the URL. The project is its name in muted text, not a coloured dot |
| States | Loading · storage error · no sessions (EmptyState + Add a missed session) · no matches (Clear search and filters) · from Insights · a running session · archived · manual, corrected, syncing, needs attention · longest and shortest title · over 60 rows |
| Phone | Stacked rows: title and net, range and breaks, bar, pills. Sort full width. Filters as a bottom sheet |
| Next step | A row opens `/sessions/view?id=`; Add missed session opens `/sessions/new` |
| Must change | Rows are lines in one list, not cards. The day-split bar uses two greys with breaks as gaps. Pills follow the tone map at one size. No brand-coloured net for a running session: the pill says it |

#### `/sessions/view?id=` Session (R2)
| Field | Plan |
| --- | --- |
| Purpose | Check one shift: its times, its net, how it counts on each day. Correct it when it is wrong |
| Who arrives | From a row in Sessions, Home's last session, a link in Insights, Privacy or the XP log. They know which shift they opened |
| Type | Focus |
| Primary action | None at rest: **Edit times** is an outline next to the title, and the solid button lives in its sheet (Save correction). In the trash: **Restore** is solid, Delete forever is outline → red confirm |
| Content 1 | Title, "{date} · {range} {zone}", net worked as `text-display` with the goal in words and a `ProgressBar` |
| Content 2 | The timeline (work and breaks across midnight), what it adds to each day (rows linking to `/sessions?date=`), elapsed, breaks, days |
| Content 3 | Details edited in place (title, project, tags, notes, mood, energy), location points, history of corrections, the "…" menu (Change reporting timezone, Archive, Move to trash) |
| Pattern | A page, two columns from 1024px. Sections under small titles, divided by lines; no card per section. The timeline is bars on a time axis: dark for work, light for a break, a labelled tick at each midnight, legend beside |
| States | Loading · not on this device · running (live clock, no end) · in the trash (notice, fields disabled) · archived · device clock ahead or behind, timezone changed (amber notice: icon and sentence) · changed since opened · no breaks · no location asked · with corrections · long title wraps |
| Phone | One column: summary, timeline as a vertical rail, days, details, location, history |
| Next step | Edit times → toast, stays. Move to trash → toast with Undo, back to Sessions. Delete forever → Trash. Both sheets: Cancel outline, primary last; an overlap asks once more before saving |
| Must change | The 92px ring becomes a bar and words. Six cards become sections. Mood and energy are segmented controls with words. Warning notices are an icon and a sentence on an amber tint, not tinted cards with borders |

Sheets: **Edit times** (Start, End, breaks, a preview of net and the per-day split, "Why are you changing it?" required; Save correction solid, "Save anyway (overlap)" → confirm) and **Reporting timezone** (picker, a before and after table per day; Use this timezone solid).

#### `/sessions/new` Add session (R2)
| Field | Plan |
| --- | --- |
| Purpose | Record a shift that was not clocked |
| Who arrives | From Add missed session on the list or its empty state. They know roughly when they worked |
| Type | Make |
| Primary action | **Add session** (becomes "Save anyway (overlap)" → confirm). Cancel is a link |
| Content 1 | Start and end, in the chosen timezone |
| Content 2 | Breaks; the preview (net, range, per-day split) and the verdict when times overlap another session |
| Content 3 | Title, project, tags, notes, each marked (optional); "Saved as Manual, with no location." |
| Pattern | One column, 24 to 32rem, required first. Start and End share a row from 640px. The button is disabled only with the verdict written above it |
| States | Loading · defaults · end before start · longer than a day · overlap · still in the future · save failed (sentence above the button) |
| Phone | One column; the buttons stack, Add session on top |
| Next step | Toast "Session added", then the new session's page |
| Must change | Two cards become one form with a divider before the optional part; errors move above their fields |

#### `/sessions/trash` Trash (R2)
| Field | Plan |
| --- | --- |
| Purpose | Bring a deleted shift back, or remove it for good |
| Who arrives | From Trash (n) on the list, or after Move to trash. They know what they deleted |
| Type | Overview |
| Primary action | None. Per row: Restore (outline) and Delete forever (link) → red confirm. Empty trash is an outline → red confirm |
| Content 1 | Rows: title, "{date} · {range}", net |
| Content 2 | "Deleted 3 days ago"; the row's two actions |
| Content 3 | The sentence that trashed sessions do not count; Empty trash |
| Pattern | One divided list, narrow column |
| States | Loading · empty ("The trash is empty." + Back to sessions) · one · many · an action running (that row's buttons disabled) |
| Phone | Rows stack; the two actions sit under the text |
| Next step | Restore → toast, the row leaves. Emptied → the empty state |
| Must change | Red buttons at rest become quiet; rows lose their cards |

#### `/insights` Insights (R3)
| Field | Plan |
| --- | --- |
| Purpose | See how much was worked in a period and how it falls on each day |
| Who arrives | The worker at the end of a week or month: from the nav or Home's week. They want totals first, patterns second |
| Type | Overview |
| Primary action | None: the screen is for reading. Share week / Share recap and Mark this week reviewed are outlines; reviewed shows a `success` pill |
| Content 1 | The range (Today, Week, Month, Year, Custom; previous and next; its label) and the answer: net worked for the range as `text-display`, with Breaks, Days worked and Avg per day as figures, then **Net per day** (or week, or month) as bars against the goal |
| Content 2 | The mode (Allocate to calendar days · Group by session start date) with its example sentence; Records (eight figures linking to their sessions); the day-split ribbon; the month calendar |
| Content 3 | Activity (7, 30, 90 days), Clock-in time, Session length, Month on month, Places, Earnings (pay tracking on) |
| Pattern | Sections under small titles in one column on phones, two from 1024px, divided by space and lines: no card per chart. Each chart: title, one line, a headline figure, the chart, legend, Table / Chart switch, an empty sentence. Range, date, mode, heat span and `session` stay in the URL |
| States | Loading · storage error (Reload) · no sessions at all (EmptyState + Clock in) · nothing in this range ("Go to your latest shift") · a running session in range · the two modes differ (the note) · a chart failed (Try again) · `?session=` view (back link, four figures, the ribbon, a per-day table, Open session; not on this device; in the trash) · pay off, no places |
| Phone | One column, range control full width, short labels ("Calendar days", "Review week"); tables scroll inside their own box |
| Next step | Any figure or bar opens the sessions behind it (`/sessions?ids=`, `?date=`, or one session). Share opens a dialog: the image, Include place names, Download solid, Share outline |
| Must change | **Hours in motion goes**: the concentric rings and radial spokes answer what the bars already answer. Its total, breaks, days worked and average become the figures above the bars; its Live pill becomes "Clocked in". Calendar and heatmap tints are steps of grey with the hours written in the cell. The pulsing circle on a running band goes. The recap image is redrawn in the light theme (white, near-black, greys): it is an exported picture, so its literal colours are a documented exception |

#### `/companion` Companion (R4)
| Field | Plan |
| --- | --- |
| Purpose | See Mochi and what healthy logging has unlocked; change what she wears and her room |
| Who arrives | From the nav, Home's rhythm line, or after a new achievement. They are here for fun, not for work |
| Type | Overview |
| Primary action | None. A tap on an unlocked item wears it at once; Rename is a ghost icon button with a label |
| Content 1 | Mochi in her habitat (the drawing, in its own colours), her name and what she says; the level with XP as a `ProgressBar` and "340 / 500 XP · 160 XP to level 8" |
| Content 2 | Wardrobe · Room · Achievements · XP log (a segmented control; `?tab=`). Item tiles: the drawing, the name, and its state in words (Wearing, Level 9, Earn Night Owl). Rhythm: Now, Best, Freezes as figures and today's line |
| Content 3 | Coming up (the next three unlocks), How XP works (a disclosure), the new-achievement notice |
| Pattern | The habitat is the one picture and its own box. Level and rhythm are figures with no box. Items are a grid of tiles (each a distinct object: one border); the worn item is marked twice (a darker border and "Wearing" with a check). Locked tiles are not buttons: muted, a lock icon and the words. Achievements and the XP log are divided lists |
| States | Loading · storage error · new achievement (one or several) · every level unlocked · room full (toast) · an outdoor background (the wall-decor note) · no XP yet (EmptyState + Go to Home) · rename: empty, too long · the longest name (24) |
| Phone | One column: Mochi, level, rhythm, the tabs, tiles two across. From 1024px Mochi on the left, level and rhythm on the right; tiles four or five across |
| Next step | Wearing an item updates Mochi above at once. An earned achievement links to its session |
| Must change | Level and name pills over the picture become text under it. Orange "celebrate" tints, tinted XP chips and glow go: XP is "+20 XP" in plain tabular text. The celebration is a quiet notice (Mochi small, the achievement's name, Dismiss); nothing bounces outside the drawing itself. `src/components/mochi/gallery.tsx` (an unused pose sheet with its own colours) becomes gallery pages or is deleted |

#### `/settings` and its pages (R5)
Structure stays: from 1024px a side list (Tracking: Your sessions, Pay, Places · You: Appearance, Privacy, Your data, Account · Device: This device) beside the page; below it `/settings` is the menu and every page has "‹ Settings". Preferences save on change (`updateSettings`); a failed save says so in a toast.
People arrive from the nav or from a link that names the page (Insights → Location settings, the sync sheet → Account); they know which setting they came for. Phones: one column, each row's label above its control, 44px targets. Next step: a change is saved in place and confirmed there; "‹ Settings" leads back to the menu. Type and the one solid button of each page are in the table at the top of this section.

| Screen | Purpose | Content 1 · 2 · 3 | States | Must change |
| --- | --- | --- | --- | --- |
| `/settings` (menu, phones) | Find the setting to change | 1 the eight rows, each a label and its current value ("16h goal · Dar es Salaam") · 2 group names · 3 Try demo data (outline) | Loading (values as skeletons) · demo on (Exit demo) | Group names are captions in sentence case. Rows are lines in one list per group, icons quiet and small, no tinted icon circles, no card per row |
| `/settings/sessions` | Say how new sessions start and how days are counted | 1 Default goal (hours and minutes), Reporting timezone (opens the picker sheet) · 2 Week starts on, Clock, Planned workdays, Rest reminders (Remind me at, Break nudge, Notifications) · 3 Safety limit (switch, then Limit) | Loading · goal invalid (four sentences) · notifications blocked, unsupported, iPhone not installed (switch disabled with the reason beside it) · limit on | Workday and reminder chips are toggle buttons whose pressed state is marked twice (surface and a check). Hints sit between label and control. Errors above the field |
| `/settings/appearance` | Choose light or dark, and how the app feels | 1 Theme (Light, Dark, System) · 2 Reduce motion, Haptics · 3 Your name | Loading | **The Accent colour row is removed** (D13: one action colour, so it changes nothing). The saved value is left as it is. Needs Bill's nod before R5 starts |
| `/settings/pay` | Turn pay estimates on and set the rate | 1 Track pay · 2 Currency, Default hourly rate with "TZS / hour" · 3 the note that amounts are never converted | Off (only the switch) · on with no rate · invalid amount | The rate field is short (it holds a number), unit beside it |
| `/settings/places` | Name the places worked at | 1 Remembered places: name, radius, Forget · 2 Use my current location (outline) and the new-place form (Name, Radius; **Save place** solid, Cancel link) · 3 From your sessions (Save as place, outline `xs`) | Loading · no places (inline EmptyState) · locating · location refused (the sentence from `LOCATION_STATUS_COPY`) · form open · name missing | Forget is a ghost icon button with a tooltip, red only in its confirm. Rows are lines, not cards |
| `/settings/device` | Install SHIFTY and see what this browser can do | 1 Install: **Install SHIFTY** solid when the browser offers it, otherwise the steps for this device · 2 What this device supports: a table of feature, detail, Yes / Partly / No (icon and word) · 3 the lock-screen note, demo | Installed (the guide is hidden) · prompt available · iOS · Android · other · notifications not asked (Allow notifications, outline) | Yes / Partly / No are pills by tone (`success`, `warning`, `neutral`), never colour alone. Steps are a numbered list, not three boxes |
| `/settings/privacy` | Decide when location is asked and how long points are kept | 1 At clock-in, At clock-out (switches) · 2 Keep location points (30 days, 90 days, 1 year, Keep), Every location point (rows: date and title linking to the session, moment, accuracy, place; delete) · 3 Show coordinates (link), Delete all (outline → red confirm), What SHIFTY doesn't do | Loading · no points (EmptyState, inline) · over 50 (Show more) · shortening the period with older points (confirm) | Delete all is quiet at rest. The four "doesn't do" lines are a plain list |
| `/settings/data` | Take a copy of everything, or bring a backup in | 1 Export: Leave out precise location, then JSON backup, Sessions CSV, Day allocations CSV (three equal outlines) · 2 Import: Choose a backup file (outline) → the preview: four figures, what will not be added, **Add N sessions** solid, Cancel link · 3 Printable report: Month, Print or save as PDF (outline), the preview | Loading · export failed · file unreadable · nothing to add · conflicts · adding · empty month | The preview's four counters are `StatTile`s with no boxes. The report preview is always light (it is paper). Its print rules stay |
| `/settings/account` | Know where the data lives; sign in, sync, sign out, erase | 1 On this device (where the data is, how many sessions, how many waiting) and Sync (the state sentence) · 2 the state's action: **Sign in** solid and Create account outline when signed out · **Upload this device's data** solid when it is waiting · Sync now and Sign out outlines when signed in · 3 Your account data (Download my data link, Delete my account), Erase this device | Loading · demo · sync not set up · not signed in · signed in · upload waiting · another account's data · signed out with changes waiting | Delete my account, Erase this device and Sign out are outlines at rest; red appears only in their dialogs, which keep typing the email or ERASE. One solid button at most on the page |

Phone nav: Home · Sessions · Insights · Companion · Settings (five tabs, D18).

## 5. Capabilities detected → team
| Capability | Evidence in brief |
| --- | --- |
| UI_HEAVY | 16 screens, a dozen chart types, designed dark + light themes, mascot poses |
| MOBILE_HEAVY, PWA | One-tap clock on the phone mid-shift; installed iPhone PWA; haptics |
| OFFLINE | "Durable IndexedDB queue … Local / Syncing / Synced / Needs attention" (`pwa.offline` = offline-queue) |
| COMPLEX_DATA | Event log + reducer, revisions, allocations across midnight/DST, rewards ledger, 11 tables |
| SUPABASE, AUTH | Cross-device sync, accounts, ADMIN_EMAIL bootstrap |
| REPORTING | Insights, printable report, shareable recap |
| IMPORT_EXPORT | CSV + JSON export, import with dry run |
| SENSITIVE_DATA | Precise location fixes, work patterns; privacy centre, retention, redaction |
| PRODUCTION_RELEASE | Every app ships (vercel.app production) |
| Not declared | PAYMENTS, MESSAGING, EMAIL beyond auth, PUSH (server push deferred, A06), SCHEDULED_JOBS (none), CUSTOM_DOMAIN (vercel.app), MULTI_TENANT (one company org), FILE_UPLOADS, REALTIME, THIRD_PARTY_API (no geocoding, A05) |

| Agent | Chosen? | Why |
| --- | --- | --- |
| orchestrator | yes | Base team; also sets up the Vercel preview project and env (no devops lane needed) |
| product-architect | yes | Base team: this blueprint and PRODUCT.md |
| ux-architect | yes | UI_HEAVY + MOBILE_HEAVY: shell, tokens for ink/cream themes, chart and mascot system |
| database-engineer | yes, covers supabase-engineer | COMPLEX_DATA: tables, constraints, `commit_shift_events()`, RLS; Auth SMTP/URL config is small and later |
| frontend-engineer | yes | Base team: home, sessions, insights, companion, settings |
| backend-engineer | yes | Base team + OFFLINE + REPORTING + IMPORT_EXPORT: reducer, allocation and reward engines, sync API, export/import |
| pwa-mobile-engineer | yes | PWA, MOBILE_HEAVY, OFFLINE: IndexedDB log, service worker shell, local notifications, badge, haptics |
| security-reviewer | yes | AUTH, SENSITIVE_DATA (location), sync API, device-mode public shell |
| qa-engineer | yes | Base team + OFFLINE: fixtures A–O, airplane-mode and two-device tests |
| release-engineer | yes | PRODUCTION_RELEASE |
| integration-engineer | no | No third-party integration in phase 1 (A05, A06; no payments, no email beyond auth) |
| devops-engineer | no | No custom domain; Vercel preview/production on vercel.app handled by the orchestrator; CI from the template |
| documentation-engineer | no | Single user, no company rollout or handover; README/PRODUCT kept by owners |

## 6. Platform decisions
| Topic | Decision | Default or deviation |
| --- | --- | --- |
| Stack | nextjs-supabase template, company tenancy, `--no-example` | default |
| Data model | Local-first event sourcing: device event log → pure reducer `src/lib/shifts/reducer.ts` (takes `now`) → sessions; server re-runs the same reducer and commits via `commit_shift_events()` with revision checks | deviation (D-entry by orchestrator) |
| Sync API | `GET /api/sync/state` (pull, cursor) · `POST /api/sync/events` (ordered batch, idempotent per event id, 409 on conflict) | default conventions |
| Device mode | App works signed out / without Supabase; tracking routes are a public static shell that reads IndexedDB; every `/api/sync/*` still requires a session | deviation |
| PWA | On; installed iPhone first | default (decided per product) |
| Offline | offline-queue: IndexedDB log + outbox, retry on open/online/foreground/manual; Background Sync only where supported | deviation (template SW caches nothing) |
| Service worker | Precache static app shell routes + `/_next/static/**`; never API responses, never personal HTML (data comes from IndexedDB) | deviation |
| Timer | Rendered from absolute timestamps each frame/second, never tick counting | default |
| Notifications | Rest prompts and milestones as local notifications while the app is open + Badging API; labelled not equivalent to iOS Live Activities | deviation (no server push, A06) |
| Integrations | None. No reverse geocoding (A05) | default |
| Jobs | None. Trash age, location retention and safety limit are applied deterministically on app open and on sync | default |
| Domain | None; production on `*.vercel.app` | default |
| Look | Bill's brief: deep ink/navy dark + cream light, lilac/indigo accent `#6d5dfc`, big numbers, glowing ring, mascot | deviation from doctrine §15 (product-specific, Bill's explicit brief) |
| Printing | Print stylesheet for the report; no PDF generation in phase 1 | deviation |

## 7. Assumptions and questions
A01–A09 from [BRIEF.md](BRIEF.md) are carried unchanged. Added by the product-architect:

| Id | Assumption | Impact | Needs Bill |
| --- | --- | --- | --- |
| A10 | Overlaps are refused unless explicitly confirmed (R09) | medium | no |
| A11 | Safety limit off by default; when on (default 20 h), the session ends at start + limit, labelled "Ended by safety limit"; applied deterministically by whichever device or server sees it first (derived event id) | medium | no |
| A12 | Location retention default 90 days (choices 30 / 90 / 365 / keep); applied on app open and sync, hard delete + redaction (R10) | medium | no |
| A13 | Signing in from device mode offers to upload this device's sessions; nothing uploads without a tap | medium | no |
| A14 | Sign-out warns with the unsynced count, then clears device data | medium | no |
| A15 | Events dated more than 2 min ahead of server time are accepted but flagged device_clock_ahead and shown ("Check your device clock"); never silently edited | low | no |
| A16 | Earnings = round half-up(net_ms × hourly_rate_minor / 3,600,000) in the session's currency; no overtime rules | low | no |
| A17 | Import accepts SHIFTY JSON (lossless) and CSV (start, end, breaks, timezone, note, project, tags); imported rows labelled Import | low | no |
| A18 | Phase 3 iOS Live Activities = written spec only (renewal strategy for ~8 h limit); not built | low | no |

Question for Bill (credential only, A01): create SHIFTY's own Supabase project and set its variables (see machine block).

## Machine-readable blueprint
```json
{
  "schemaVersion": 1,
  "app": {
    "name": "SHIFTY",
    "slug": "shifty",
    "oneLiner": "A person who works long, irregular shifts clocks in and out with one tap, sees net time against a 16h goal live, and gets honest per-day reports and a companion that rewards healthy logging.",
    "tenancy": "company",
    "brand": {
      "color": "#6d5dfc",
      "logo": null
    },
    "locale": {
      "timezone": "Africa/Dar_es_Salaam",
      "currency": "TZS",
      "currencyDecimals": 0,
      "language": "en",
      "weekStart": 1
    },
    "domain": {
      "host": null,
      "status": "none"
    }
  },
  "users": [
    {
      "segment": "Shift worker (Bill)",
      "estimatedCount": 1,
      "devices": ["phone", "desktop"],
      "network": "variable",
      "notes": "Installed iPhone PWA mid-shift; desktop for insights; sessions often cross midnight"
    },
    {
      "segment": "Invited members (later)",
      "estimatedCount": 5,
      "devices": ["phone"],
      "network": "variable",
      "notes": "Each sees only their own shifts"
    }
  ],
  "roles": [
    {
      "key": "admin",
      "label": "Admin",
      "capabilities": ["shift:track", "member:manage", "settings:manage", "audit:view"],
      "home": "/",
      "signsIn": true
    },
    {
      "key": "member",
      "label": "Member",
      "capabilities": ["shift:track"],
      "home": "/",
      "signsIn": true
    }
  ],
  "entities": [
    {
      "name": "Settings",
      "table": "user_settings",
      "tenantScoped": true,
      "fields": [
        { "name": "user_id", "type": "reference", "required": true, "references": "profiles", "notes": "unique; one row per user" },
        { "name": "reporting_timezone", "type": "text", "required": true, "notes": "IANA; device timezone at first launch, fallback Africa/Dar_es_Salaam (A03)" },
        { "name": "goal_net_ms", "type": "integer", "required": true, "notes": "default 57600000 (16h net); a goal, not a limit" },
        { "name": "clock_format", "type": "enum", "required": true, "values": ["h12", "h24"] },
        { "name": "week_start", "type": "integer", "required": true, "notes": "0-6, default 1" },
        { "name": "theme", "type": "enum", "required": true, "values": ["system", "light", "dark"] },
        { "name": "accent", "type": "text", "notes": "palette key" },
        { "name": "allocation_mode", "type": "enum", "required": true, "values": ["allocate_days", "group_by_start"] },
        { "name": "location_enabled", "type": "boolean", "required": true },
        { "name": "location_retention_days", "type": "integer", "notes": "30/90/365 or null = keep; default 90 (A12)" },
        { "name": "reminders", "type": "jsonb", "required": true, "notes": "{ enabled, milestones_h: [12,14,16] }" },
        { "name": "safety_limit_enabled", "type": "boolean", "required": true, "notes": "default false" },
        { "name": "safety_limit_hours", "type": "integer", "notes": "default 20 (A11)" },
        { "name": "pay_tracking_enabled", "type": "boolean", "required": true, "notes": "default false (A04)" },
        { "name": "default_hourly_rate_minor", "type": "money_minor", "notes": "integer minor units" },
        { "name": "pay_currency", "type": "text", "required": true, "notes": "ISO 4217, default TZS" },
        { "name": "haptics_enabled", "type": "boolean", "required": true },
        { "name": "revision", "type": "integer", "required": true }
      ],
      "deletion": "never",
      "audit": true,
      "owner": "member"
    },
    {
      "name": "Session",
      "table": "shift_sessions",
      "tenantScoped": true,
      "fields": [
        { "name": "id", "type": "uuid", "required": true, "notes": "generated on the device at clock-in; same id on every device and the server" },
        { "name": "user_id", "type": "reference", "required": true, "references": "profiles" },
        { "name": "started_at", "type": "timestamptz", "required": true, "notes": "tap time; never moved by location capture (R05)" },
        { "name": "ended_at", "type": "timestamptz", "notes": "null while active; > started_at" },
        { "name": "reporting_timezone", "type": "text", "required": true, "notes": "IANA, snapshotted at clock-in" },
        { "name": "goal_net_ms", "type": "integer", "required": true },
        { "name": "source", "type": "enum", "required": true, "values": ["live", "manual", "import"] },
        { "name": "ended_by", "type": "enum", "values": ["user", "safety_limit"] },
        { "name": "project_id", "type": "reference", "references": "work_projects" },
        { "name": "place_id", "type": "reference", "references": "saved_places" },
        { "name": "tags", "type": "text", "notes": "text[]; max 10, lowercased" },
        { "name": "note", "type": "text", "notes": "max 2000" },
        { "name": "mood", "type": "integer", "notes": "1-5, from the clock-out recap" },
        { "name": "energy", "type": "integer", "notes": "1-5" },
        { "name": "hourly_rate_minor", "type": "money_minor", "notes": "only when pay tracking is on" },
        { "name": "pay_currency", "type": "text", "notes": "ISO 4217; required when hourly_rate_minor is set" },
        { "name": "net_ms", "type": "integer", "required": true, "notes": "derived by the reducer on commit" },
        { "name": "break_ms", "type": "integer", "required": true, "notes": "derived by the reducer on commit" },
        { "name": "revision", "type": "integer", "required": true, "notes": "bumped on every commit; base for conflict checks" },
        { "name": "archived_at", "type": "timestamptz" },
        { "name": "deleted_at", "type": "timestamptz", "notes": "set = in trash (A09); purge = hard delete + session_purged tombstone event" }
      ],
      "statuses": ["active", "completed", "archived", "trashed"],
      "deletion": "hard",
      "audit": true,
      "owner": "member"
    },
    {
      "name": "Break",
      "table": "shift_breaks",
      "tenantScoped": true,
      "fields": [
        { "name": "id", "type": "uuid", "required": true, "notes": "device-generated" },
        { "name": "user_id", "type": "reference", "required": true, "references": "profiles" },
        { "name": "session_id", "type": "reference", "required": true, "references": "shift_sessions", "notes": "composite FK (organization_id, session_id)" },
        { "name": "started_at", "type": "timestamptz", "required": true },
        { "name": "ended_at", "type": "timestamptz", "notes": "null while running; one open break per session" },
        { "name": "kind", "type": "enum", "values": ["rest", "meal", "other"] }
      ],
      "deletion": "hard",
      "audit": true,
      "owner": "member"
    },
    {
      "name": "Location fix",
      "table": "location_snapshots",
      "tenantScoped": true,
      "fields": [
        { "name": "user_id", "type": "reference", "required": true, "references": "profiles" },
        { "name": "session_id", "type": "reference", "required": true, "references": "shift_sessions" },
        { "name": "moment", "type": "enum", "required": true, "values": ["clock_in", "clock_out", "retry"] },
        { "name": "outcome", "type": "enum", "required": true, "values": ["captured", "denied", "timeout", "unavailable"] },
        { "name": "position", "type": "geo", "notes": "present only when outcome = captured (CHECK); never guessed" },
        { "name": "accuracy_m", "type": "numeric" },
        { "name": "captured_at", "type": "timestamptz", "required": true, "notes": "time of the fix or failure; independent of started_at" },
        { "name": "place_id", "type": "reference", "references": "saved_places", "notes": "matched by distance on the device (A05)" }
      ],
      "deletion": "hard",
      "audit": true,
      "owner": "member"
    },
    {
      "name": "Event",
      "table": "shift_events",
      "tenantScoped": true,
      "fields": [
        { "name": "id", "type": "uuid", "required": true, "notes": "device_event_id; unique; replay returns the original result" },
        { "name": "user_id", "type": "reference", "required": true, "references": "profiles" },
        { "name": "session_id", "type": "uuid", "notes": "target session; null for settings events" },
        { "name": "type", "type": "enum", "required": true, "values": ["session_started", "session_ended", "session_end_undone", "break_started", "break_ended", "location_recorded", "location_deleted", "session_corrected", "session_annotated", "manual_session_added", "session_imported", "session_archived", "session_unarchived", "session_trashed", "session_restored", "session_purged", "session_auto_ended", "weekly_reviewed", "settings_changed"] },
        { "name": "payload", "type": "jsonb", "required": true, "notes": "Zod schema per type; location coordinates redacted on delete (R10)" },
        { "name": "occurred_at", "type": "timestamptz", "required": true, "notes": "device time of the tap; refused if > 10 min ahead of server time (A15)" },
        { "name": "recorded_at", "type": "timestamptz", "required": true, "notes": "server commit time" },
        { "name": "device_id", "type": "text", "required": true, "notes": "random id per installation" },
        { "name": "base_revision", "type": "integer", "notes": "session revision the device saw; stale on a correction = 409" }
      ],
      "deletion": "never",
      "audit": true,
      "owner": "member"
    },
    {
      "name": "Revision",
      "table": "session_revisions",
      "tenantScoped": true,
      "fields": [
        { "name": "user_id", "type": "reference", "required": true, "references": "profiles" },
        { "name": "session_id", "type": "reference", "required": true, "references": "shift_sessions" },
        { "name": "revision", "type": "integer", "required": true, "notes": "unique (session_id, revision)" },
        { "name": "reason", "type": "text", "required": true, "notes": "3-500 chars" },
        { "name": "previous", "type": "jsonb", "required": true, "notes": "start, end, timezone, breaks; never coordinates" },
        { "name": "updated", "type": "jsonb", "required": true },
        { "name": "event_id", "type": "reference", "required": true, "references": "shift_events" }
      ],
      "deletion": "never",
      "audit": true,
      "owner": "member"
    },
    {
      "name": "Project",
      "table": "work_projects",
      "tenantScoped": true,
      "fields": [
        { "name": "user_id", "type": "reference", "required": true, "references": "profiles" },
        { "name": "name", "type": "text", "required": true, "notes": "unique per user, case-insensitive" },
        { "name": "color", "type": "text" },
        { "name": "archived_at", "type": "timestamptz" }
      ],
      "deletion": "archive",
      "audit": false,
      "owner": "member"
    },
    {
      "name": "Saved place",
      "table": "saved_places",
      "tenantScoped": true,
      "fields": [
        { "name": "user_id", "type": "reference", "required": true, "references": "profiles" },
        { "name": "label", "type": "text", "required": true },
        { "name": "position", "type": "geo", "required": true },
        { "name": "radius_m", "type": "integer", "required": true, "notes": "default 150" }
      ],
      "deletion": "hard",
      "audit": false,
      "owner": "member"
    },
    {
      "name": "Reward entry",
      "table": "reward_ledger_entries",
      "tenantScoped": true,
      "fields": [
        { "name": "user_id", "type": "reference", "required": true, "references": "profiles" },
        { "name": "event_key", "type": "text", "required": true, "notes": "unique (user_id, event_key), e.g. session_completed:<session_id>" },
        { "name": "kind", "type": "enum", "required": true, "values": ["session_logged", "session_completed", "healthy_break", "routine", "weekly_review", "achievement", "reversal"] },
        { "name": "xp", "type": "integer", "required": true, "notes": "capped; never scales with hours; negative only for reversal" },
        { "name": "session_id", "type": "reference", "references": "shift_sessions", "notes": "set null on purge" },
        { "name": "rule_version", "type": "integer", "required": true }
      ],
      "deletion": "never",
      "audit": true,
      "owner": "member"
    },
    {
      "name": "Achievement",
      "table": "user_achievements",
      "tenantScoped": true,
      "fields": [
        { "name": "user_id", "type": "reference", "required": true, "references": "profiles" },
        { "name": "achievement_key", "type": "enum", "required": true, "values": ["first_clock_in", "night_owl", "consistency_week", "break_champion", "data_keeper", "first_100h", "comeback"], "notes": "unique (user_id, achievement_key)" },
        { "name": "unlocked_at", "type": "timestamptz", "required": true },
        { "name": "session_id", "type": "reference", "references": "shift_sessions", "notes": "set null on purge" }
      ],
      "deletion": "never",
      "audit": false,
      "owner": "member"
    },
    {
      "name": "Companion",
      "table": "companion_states",
      "tenantScoped": true,
      "fields": [
        { "name": "user_id", "type": "reference", "required": true, "references": "profiles", "notes": "unique; one row per user" },
        { "name": "level", "type": "integer", "required": true, "notes": "highest reached; never decreases" },
        { "name": "xp_total", "type": "integer", "required": true, "notes": "cache of the ledger sum" },
        { "name": "equipped", "type": "jsonb", "required": true, "notes": "{ palette, hat, decor, background }" },
        { "name": "inventory", "type": "jsonb", "required": true, "notes": "unlocked item keys; never shrinks" },
        { "name": "streak", "type": "jsonb", "required": true, "notes": "{ current, best, freezes, rest_days }" }
      ],
      "deletion": "never",
      "audit": false,
      "owner": "member"
    }
  ],
  "coreRules": [
    {
      "id": "R01",
      "rule": "One active session per user: a second clock-in while one is open is refused and the open one is shown",
      "enforcedIn": ["database", "api", "ui"],
      "test": "partial unique index shift_sessions (user_id) where ended_at is null and deleted_at is null; DB double-start test; sync route 409; reducer test"
    },
    {
      "id": "R02",
      "rule": "Net time splits at local midnights of the session's reporting timezone and the day allocations sum exactly to net (integer ms), DST-safe",
      "enforcedIn": ["api", "ui"],
      "test": "pure engine src/lib/shifts/allocation.ts shared by client and server; fixtures A-O plus property test sum = net; Mon 18:00-Tue 10:00 = Mon 6h + Tue 10h; with a Tue 02:00-02:30 break = Mon 6h + Tue 9h30"
    },
    {
      "id": "R03",
      "rule": "Every correction of start, end, timezone or breaks carries a reason and writes a session_revisions row with previous and updated values in the same transaction",
      "enforcedIn": ["database", "api", "ui"],
      "test": "commit_shift_events() refuses a correction without a 3-500 char reason; guard trigger refuses direct started_at/ended_at updates; route test 400; DB test revision row written"
    },
    {
      "id": "R04",
      "rule": "Ends are after starts; breaks stay inside their session, never overlap, and only one break is open at a time",
      "enforcedIn": ["database", "api", "ui"],
      "test": "CHECK constraints; btree_gist exclusion constraint on break ranges per session; containment constraint trigger; reducer tests"
    },
    {
      "id": "R05",
      "rule": "Location never moves the clock-in start, and a failed capture is stored as not captured with its reason, never a guessed position",
      "enforcedIn": ["database", "api", "ui"],
      "test": "CHECK outcome = captured iff position present; commit function never writes started_at from a location event; reducer test with a fix arriving 40s late"
    },
    {
      "id": "R06",
      "rule": "Sync is idempotent and never silently overwrites: replays return the original result, stale corrections get 409 and stay on the device as Needs attention, purged sessions are never resurrected",
      "enforcedIn": ["database", "api", "ui"],
      "test": "unique shift_events id; route tests for replay 200, stale base_revision 409, replay after purge ignored; e2e offline replay"
    },
    {
      "id": "R07",
      "rule": "A person sees and changes only their own tracking rows, admins included",
      "enforcedIn": ["database"],
      "test": "scripts/check-rls.ts: second member and admin see 0 rows of the first member on every tracking table; outsider sees nothing"
    },
    {
      "id": "R08",
      "rule": "XP never grows with hours worked; caps per session and per day; the ledger is a deterministic idempotent function of history; corrections write reversal rows; unlocked items and levels are never removed",
      "enforcedIn": ["database", "api"],
      "test": "unique (user_id, event_key); reward engine tests: 8h and 20h sessions earn equal completion XP, recompute twice adds no rows, correction adds a reversal, level never decreases"
    },
    {
      "id": "R09",
      "rule": "No unintentional overlap: clock-in, manual entry, import, restore and corrections that would overlap another session are refused naming it unless the person explicitly confirms",
      "enforcedIn": ["api", "ui"],
      "test": "reducer findOverlap shared by device and server; reducer and route tests 409"
    },
    {
      "id": "R10",
      "rule": "Deleting a location fix removes its coordinates everywhere: the row is hard-deleted and the originating event payload is redacted; later exports contain none",
      "enforcedIn": ["database", "api", "ui"],
      "test": "DB test: no row and no coordinates in shift_events.payload after location_deleted; device log redaction test; export test"
    }
  ],
  "flows": [
    {
      "id": "F01",
      "name": "Track a shift",
      "roles": ["admin", "member"],
      "steps": [
        "Tap Clock in; start = tap time, written to the device event log at once",
        "Location requested in the background: captured, or Location not captured with reason and Retry; start never moves",
        "Optionally add note, project, tags, place, pay rate",
        "Active hero: total elapsed vs net worked, goal ring capped at 100% with overage, predicted finish, start date/time/zone; ribbon on every page",
        "Start and end breaks",
        "Supportive rest prompts at 12h, 14h, 16h+",
        "Tap Clock out; end = tap time; 8 second undo",
        "Recap: net, breaks, per-day split, XP, Mochi; optional mood, energy, note"
      ],
      "core": true
    },
    {
      "id": "F02",
      "name": "Offline and sync",
      "roles": ["admin", "member"],
      "steps": [
        "Every action is an event with a device uuid in IndexedDB (Local)",
        "On app open, online, foreground or Sync now: POST /api/sync/events in order (Syncing)",
        "Server re-runs the reducer and commits atomically through commit_shift_events() (Synced)",
        "Replays return the original result; a stale correction returns 409 and shows Needs attention",
        "User keeps the server version or re-applies theirs as a new correction with a reason",
        "GET /api/sync/state pulls changes from other devices"
      ],
      "core": true
    },
    {
      "id": "F03",
      "name": "Review and correct sessions",
      "roles": ["admin", "member"],
      "steps": [
        "Open /sessions: timeline cards with filters and search",
        "Open a session: one timeline across midnight, per-day contributions, breaks, fixes, revisions",
        "Edit start, end or breaks and give a reason",
        "Preview the new per-day split and save",
        "Revision written; reports and XP recompute"
      ],
      "core": true
    },
    {
      "id": "F04",
      "name": "Add a manual session",
      "roles": ["admin", "member"],
      "steps": [
        "Open /sessions/new and enter start, end, breaks, timezone, note",
        "Overlap check against other sessions",
        "Saved and labelled Manual"
      ],
      "core": false
    },
    {
      "id": "F05",
      "name": "Read insights",
      "roles": ["admin", "member"],
      "steps": [
        "Pick a range: today, week, month, year, custom, session",
        "Pick allocation mode: allocate to days or group by start date",
        "Read charts with tooltips and text alternatives",
        "Drill down to the sessions behind a number",
        "Share a recap without location"
      ],
      "core": false
    },
    {
      "id": "F06",
      "name": "Companion and rewards",
      "roles": ["admin", "member"],
      "steps": [
        "Open /companion: Mochi pose and habitat, level, XP log, achievements, forgiving streak",
        "Equip unlocked palettes, hats, decor, backgrounds"
      ],
      "core": false
    },
    {
      "id": "F07",
      "name": "Data and privacy",
      "roles": ["admin", "member"],
      "steps": [
        "Export CSV or JSON with UTC instants, timezone, allocations and audit; print the report",
        "Import JSON or CSV with a dry run and per-row errors",
        "Turn location on or off, set retention, see and delete fixes, manage saved places",
        "Download my data or delete my account"
      ],
      "core": false
    },
    {
      "id": "F08",
      "name": "Trash",
      "roles": ["admin", "member"],
      "steps": [
        "Delete a session: it moves to trash for 30 days",
        "Restore it, or empty trash: hard delete with a tombstone; rewards recompute"
      ],
      "core": false
    },
    {
      "id": "F09",
      "name": "Device mode to account",
      "roles": ["admin", "member"],
      "steps": [
        "Use SHIFTY signed out; data labelled On this device",
        "Sign up or sign in",
        "Offered to upload this device's sessions; nothing uploads without a tap",
        "Sign out warns with the unsynced count, then clears device data"
      ],
      "core": false
    }
  ],
  "screens": [
    { "route": "/", "purpose": "Home: greeting + Mochi, Clock in or active hero, goal ring, last session, week sparkline (device mode when signed out)", "roles": ["admin", "member", "public"], "primaryAction": "Clock in / Clock out", "phoneLayout": "dashboard" },
    { "route": "/sessions", "purpose": "History timeline cards, filters, search, Needs attention filter", "roles": ["admin", "member", "public"], "primaryAction": "Add session", "phoneLayout": "cards" },
    { "route": "/sessions/[id]", "purpose": "Unified timeline, per-day split, breaks, fixes, revisions, edit with reason, conflict resolution", "roles": ["admin", "member", "public"], "primaryAction": "Edit", "phoneLayout": "detail" },
    { "route": "/sessions/new", "purpose": "Manual session entry with overlap check", "roles": ["admin", "member", "public"], "primaryAction": "Save session", "phoneLayout": "form" },
    { "route": "/sessions/trash", "purpose": "Trash: restore or empty", "roles": ["admin", "member", "public"], "primaryAction": "Restore", "phoneLayout": "cards" },
    { "route": "/insights", "purpose": "Range tabs, allocation toggle, ring, day-split ribbon, heatmap, weekly bars, month calendar, distributions, records, deltas, places, earnings", "roles": ["admin", "member", "public"], "primaryAction": null, "phoneLayout": "dashboard" },
    { "route": "/companion", "purpose": "Mochi habitat, level, XP log, achievements, wardrobe", "roles": ["admin", "member", "public"], "primaryAction": "Equip", "phoneLayout": "cards" },
    { "route": "/settings", "purpose": "Goal, timezone, 12/24h, week start, theme, accent, reminders, safety limit, pay tracking, haptics, sync status", "roles": ["admin", "member", "public"], "primaryAction": null, "phoneLayout": "form" },
    { "route": "/settings/privacy", "purpose": "Location on/off, retention, see and delete fixes, saved places", "roles": ["admin", "member", "public"], "primaryAction": "Delete location history", "phoneLayout": "form" },
    { "route": "/settings/data", "purpose": "Export CSV/JSON, printable report, import with dry run, upload device data", "roles": ["admin", "member", "public"], "primaryAction": "Export", "phoneLayout": "form" },
    { "route": "/settings/account", "purpose": "Profile, password, download my data, delete account", "roles": ["admin", "member"], "primaryAction": "Save", "phoneLayout": "form" },
    { "route": "/settings/team", "purpose": "Template team page: invite, change role, deactivate", "roles": ["admin"], "primaryAction": "Invite", "phoneLayout": "cards" },
    { "route": "/login", "purpose": "Sign in", "roles": ["public"], "primaryAction": "Sign in", "phoneLayout": "public" },
    { "route": "/signup", "purpose": "Create an account", "roles": ["public"], "primaryAction": "Sign up", "phoneLayout": "public" },
    { "route": "/privacy", "purpose": "Privacy policy (location, retention, processors)", "roles": ["public"], "primaryAction": null, "phoneLayout": "public" },
    { "route": "/data-deletion", "purpose": "Data deletion instructions (with /terms and /cookies)", "roles": ["public"], "primaryAction": null, "phoneLayout": "public" }
  ],
  "capabilities": [
    "UI_HEAVY",
    "COMPLEX_DATA",
    "SUPABASE",
    "AUTH",
    "PWA",
    "MOBILE_HEAVY",
    "OFFLINE",
    "REPORTING",
    "IMPORT_EXPORT",
    "SENSITIVE_DATA",
    "PRODUCTION_RELEASE"
  ],
  "stack": {
    "template": "nextjs-supabase",
    "deviations": [
      {
        "area": "Data model",
        "choice": "Local-first event sourcing: device IndexedDB event log folded by the pure reducer src/lib/shifts/reducer.ts; the server re-runs the same reducer and commits through commit_shift_events() with revision checks",
        "reason": "Clock-in must be instant and durable with no network; one reducer keeps device and server identical"
      },
      {
        "area": "Device mode",
        "choice": "Tracking routes are a public static shell reading IndexedDB when signed out or when Supabase is not configured; /api/sync/* always requires a session",
        "reason": "A01: no SHIFTY Supabase project yet; the app must be usable on the device meanwhile"
      },
      {
        "area": "Service worker",
        "choice": "Precache the static app shell routes and /_next/static/**; never API responses or personal HTML",
        "reason": "The clock must open with no network; data comes from IndexedDB"
      },
      {
        "area": "Notifications",
        "choice": "Local notifications while the app is open plus the Badging API; no server Web Push in phase 1",
        "reason": "A06; a PWA cannot create iOS Live Activities"
      },
      {
        "area": "Visual design",
        "choice": "Deep ink/navy dark and cream light themes, lilac/indigo accent, big numbers, glowing ring, mascot",
        "reason": "Bill's brief asks for a premium, joyful fitness-dashboard look, overriding doctrine 15 for this product"
      },
      {
        "area": "Printable report",
        "choice": "Print stylesheet; no PDF generation in phase 1",
        "reason": "Brief asks for printable, not a forwarded PDF; avoids @react-pdf weight"
      }
    ]
  },
  "pwa": {
    "enabled": true,
    "offline": "offline-queue",
    "push": false,
    "reason": "Clocking in and out happens mid-shift with variable network; server push deferred (A06)",
    "sync": {
      "scope": [
        "clock in, clock out, undo",
        "breaks",
        "location fixes and deletions",
        "corrections, notes, archive, trash, restore",
        "manual sessions",
        "settings"
      ],
      "trigger": ["online-event", "app-open", "manual", "background-sync"],
      "conflictPolicy": "Device-generated event ids make every replay idempotent (200, original result); the server re-runs the shared reducer; a correction against a stale revision is 409 with the server state and stays on the device as Needs attention until the user chooses; never a silent overwrite",
      "maxOfflineHours": 168,
      "storageBudgetMb": 50,
      "clearOnSignOut": true
    }
  },
  "integrations": [],
  "scheduledJobs": [],
  "environments": {
    "development": {
      "supabase": "shifty-dev (not created yet, A01; device mode until then)",
      "url": "http://localhost:3000"
    },
    "preview": {
      "supabase": "shifty-dev (not created yet, A01)",
      "url": "Vercel preview per PR (*.vercel.app)",
      "notes": "Device mode until SHIFTY's own Supabase variables are set; never the pasuax-executive-matrix project"
    },
    "production": {
      "supabase": "shifty-prod (not created yet)",
      "url": "Vercel production on *.vercel.app (no custom domain)"
    }
  },
  "assumptions": [
    { "id": "A01", "assumption": "Until Bill creates SHIFTY's own Supabase project the app runs in device mode; it never writes to the pasuax-executive-matrix project", "impact": "high", "needsBill": true, "status": "assumed" },
    { "id": "A02", "assumption": "Company tenancy, one org, Bill first admin via ADMIN_EMAIL; RLS own rows only, admins included", "impact": "high", "needsBill": false, "status": "assumed" },
    { "id": "A03", "assumption": "Reporting timezone defaults to the device timezone (fallback Africa/Dar_es_Salaam); each session snapshots it at clock-in", "impact": "medium", "needsBill": false, "status": "assumed" },
    { "id": "A04", "assumption": "Pay tracking off by default; hourly rate per session in minor units, TZS default; no overtime law", "impact": "low", "needsBill": false, "status": "assumed" },
    { "id": "A05", "assumption": "No reverse geocoding; place labels from saved places matched on the device", "impact": "low", "needsBill": false, "status": "assumed" },
    { "id": "A06", "assumption": "Reminders are in-app and local notifications while the app is open; server Web Push deferred", "impact": "medium", "needsBill": false, "status": "assumed" },
    { "id": "A07", "assumption": "Rewards are a pure function of history, reconciled with reversal rows; unlocked items and levels are kept", "impact": "medium", "needsBill": false, "status": "assumed" },
    { "id": "A08", "assumption": "Clock-out undo grace 8 seconds; end time is the tap time", "impact": "low", "needsBill": false, "status": "assumed" },
    { "id": "A09", "assumption": "Trash keeps sessions 30 days; the user empties it; no purge job in phase 1", "impact": "low", "needsBill": false, "status": "assumed" },
    { "id": "A10", "assumption": "One person's sessions never overlap; overlapping manual entries, imports and corrections are refused", "impact": "medium", "needsBill": false, "status": "assumed" },
    { "id": "A11", "assumption": "Safety limit off by default; when on (20h default) the session ends at start + limit, labelled, applied deterministically by the first device or server that sees it", "impact": "medium", "needsBill": false, "status": "assumed" },
    { "id": "A12", "assumption": "Location retention default 90 days (30/90/365/keep), applied on app open and sync with hard delete and redaction", "impact": "medium", "needsBill": false, "status": "assumed" },
    { "id": "A13", "assumption": "Signing in from device mode offers to upload this device's sessions; nothing uploads without a tap", "impact": "medium", "needsBill": false, "status": "assumed" },
    { "id": "A14", "assumption": "Sign-out warns with the unsynced count, then clears device data", "impact": "medium", "needsBill": false, "status": "assumed" },
    { "id": "A15", "assumption": "Events dated more than 2 minutes ahead of server time are accepted, flagged device_clock_ahead and shown; never silently edited", "impact": "low", "needsBill": false, "status": "assumed" },
    { "id": "A16", "assumption": "Earnings = round half-up(net_ms x hourly_rate_minor / 3600000) in the session currency", "impact": "low", "needsBill": false, "status": "assumed" },
    { "id": "A17", "assumption": "Import accepts SHIFTY JSON and a documented CSV; imported sessions labelled Import", "impact": "low", "needsBill": false, "status": "assumed" },
    { "id": "A18", "assumption": "Phase 3 iOS Live Activities is a written spec only, not built", "impact": "low", "needsBill": false, "status": "assumed" }
  ],
  "questionsForBill": [
    "Credential only (A01): create a Supabase project for SHIFTY (dev now, prod at release) and set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in Vercel env and the cloud environment settings (plus ADMIN_EMAIL); this switches on sign-in and cross-device sync. Until then SHIFTY runs in device mode."
  ],
  "team": {
    "chosen": [
      { "agent": "orchestrator", "reason": "Base team: plans, assigns, integrates; sets up the Vercel preview project and env vars" },
      { "agent": "product-architect", "reason": "Base team: blueprint and PRODUCT.md" },
      { "agent": "ux-architect", "reason": "UI_HEAVY and MOBILE_HEAVY: shell, ink/cream tokens, chart and mascot system, phone nav" },
      { "agent": "database-engineer", "reason": "COMPLEX_DATA and SUPABASE: tables, constraints, commit_shift_events(), RLS; also the small Auth SMTP/URL configuration", "covers": ["supabase-engineer"] },
      { "agent": "frontend-engineer", "reason": "Base team: home, sessions, insights, companion, settings screens" },
      { "agent": "backend-engineer", "reason": "Base team, OFFLINE, REPORTING, IMPORT_EXPORT: reducer, allocation and reward engines, sync API, export and import" },
      { "agent": "pwa-mobile-engineer", "reason": "PWA, MOBILE_HEAVY, OFFLINE: IndexedDB log and outbox, service worker shell, local notifications, badge, haptics" },
      { "agent": "security-reviewer", "reason": "AUTH, SENSITIVE_DATA (precise location), sync API, public device-mode shell" },
      { "agent": "qa-engineer", "reason": "Base team and OFFLINE: fixtures A-O, airplane-mode and two-device replay tests" },
      { "agent": "release-engineer", "reason": "PRODUCTION_RELEASE: single production owner" }
    ],
    "notChosen": [
      { "agent": "integration-engineer", "reason": "No third-party integration in phase 1: no geocoding (A05), no server push (A06), no payments or email beyond auth" },
      { "agent": "devops-engineer", "reason": "No custom domain; vercel.app preview and production handled by the orchestrator; CI comes from the template" },
      { "agent": "documentation-engineer", "reason": "Single user, no company rollout or handover; README and PRODUCT.md kept by their owners" }
    ]
  },
  "migrationRanges": [
    { "range": "0001-0009", "owner": "template", "purpose": "foundation (exists)" },
    { "range": "0100-0199", "owner": "database-engineer", "purpose": "SHIFTY schema, constraints, commit_shift_events(), RLS, capability map" }
  ],
  "release": {
    "owner": "release-engineer",
    "firstReleaseScope": [
      "F01 track a shift",
      "F02 offline and sync",
      "F03 review and correct sessions",
      "F04 manual session",
      "F05 insights",
      "F06 companion and rewards",
      "F07 data and privacy",
      "F08 trash",
      "F09 device mode to account"
    ],
    "productionUrl": null
  }
}
```
