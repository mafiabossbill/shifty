# SHIFTY — brief (phase 0)

Source: Bill's PRD/TRD v1.0, 25 October 2026 (pasted into the `/new-app` session). Condensed faithfully below; where
the brief is silent the default became an assumption (A01…). Nothing here needed Bill's answer before building except
the credential boundary in A01.

## What Bill asked for
| Topic | Requirement (binding) |
| --- | --- |
| Job | Tap CLOCK IN → one durable work **session**; point-in-time location if permitted; live elapsed time; optional breaks; clock out. Sessions often cross midnight. A shift is a continuous session, never a calendar day. |
| Goal | Default **16h net worked** per session; editable per session and in Settings. A goal, not a limit. No auto clock-out unless an opt-in safety limit is enabled. Reminders at 12h/14h/16h+ are supportive rest prompts. |
| Allocation | Calendar days are derived reporting buckets. Split net time at local midnights in the session's **reporting IANA timezone** (snapshotted at clock-in). Σ day allocations = session net exactly (integer ms). DST-safe (23/25h days). Two report modes: "Allocate to calendar days" and "Group by session start date". |
| Acceptance | Mon 18:00 → Tue 10:00 = 1 session, 16h, Mon 6h + Tue 10h; with Tue 02:00–02:30 break = 15h30 net, Mon 6h + Tue 9h30. Fixtures A–O (TRD §3.6) are the test list. |
| Clock-in | One tap; start time recorded immediately; GPS asked asynchronously, never shifts the start; denied/timeout/unavailable → "Location not captured" + reason + retry. Never fabricate location. Optional notes, project, tags, remembered places, pay rate. Haptics + mascot reaction. |
| Active session | Huge readout, TOTAL ELAPSED vs NET WORKED; goal ring capped at 100% with overage separate; predicted finish; start date/time/zone; breaks are ordered non-overlapping segments; one active session per account (DB-enforced); idempotent events; persistent active-session ribbon; timer from absolute timestamps, never tick counting. |
| Offline | Durable IndexedDB queue with device-generated event IDs; visible Local / Syncing / Synced / Needs attention; never silently overwrite on conflict; retry on foreground/online (Background Sync is not universal). |
| Clock-out | One tap, end captured immediately, undo grace; recap: net, breaks, days spanned, XP, mascot, optional note/mood/energy. Overage shown neutrally. |
| Corrections | Edit start/end/breaks with a reason; old/new values in audit history; reports and rewards recompute deterministically. |
| History | Timeline/card list; filter/sort/search by date, tag, location, project, length; detail with a unified timeline across midnight and per-day contributions; edit, annotate, archive, delete (recoverable trash); manual entry labelled manual with overlap check. |
| Insights | Today / week / month / year / custom / session. Hours in motion ring, day-split ribbon, 7/30/90-day heatmap, weekly bars with break + target overlays, month calendar with origin-session backlinks, clock-in time-of-day distribution, duration distribution with mean/median, records, month-on-month deltas, location breakdown (opt-in), earnings if pay tracking on, shareable recap without exact location. Every chart: empty/loading/error, both themes, text alternative, tooltips, drill-down. |
| Companion | Original mascot "Mochi" (star-blob), poses happy/focused/sleepy/resting/celebrating; habitat; XP for logging, completing, healthy breaks, routines, weekly review — capped, **never proportional to long hours**; levels; unlockable palettes/hats/decor/backgrounds; achievements (First Clock-In, Night Owl, Consistency Week, Break Champion, Data Keeper, First 100h Logged, Comeback); forgiving streaks with rest days and freezes; deterministic idempotent ledger. |
| Data | CSV + JSON export (UTC instants, reporting tz, allocations, audit), printable report, import with dry run, privacy centre (see/delete location fixes, retention), optional push reminders, 12/24h, week start, theme, accent. |
| Platform honesty | A PWA cannot create iOS Live Activities. Phase 1 = in-app timer + opt-in milestone notifications + badge where supported, labelled as not equivalent. Phase 3 = SwiftUI/ActivityKit companion spec; ~8h active limit (+4h on Lock Screen) means a 16h shift needs a documented renewal strategy. |
| Out of scope | Team scheduling, employer monitoring, payroll compliance, continuous GPS, spoof detection, leaderboards, AI coaching, shipping a native iOS app, Watch. |
| Look | Premium, joyful, fitness-dashboard energy; deep ink/navy dark theme and cream light theme; lilac/indigo accent, sage/teal success, warm orange celebration; big numbers; designed dark mode; WCAG AA; reduced motion. Reference images: dark violet glass cards, glowing progress ring, rounded nav with a central action. |

## Assumptions
| Id | Assumption | Impact | Needs Bill |
| --- | --- | --- | --- |
| A01 | The Supabase project in this environment belongs to **pasuax-executive-matrix**; SHIFTY never writes to it. Until Bill creates a SHIFTY Supabase project the app runs in **device mode** (data in this browser's IndexedDB, labelled "On this device"); sync switches on when `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` point at SHIFTY's own project. | Cross-device sync waits for credentials | Yes — credential only |
| A02 | Company tenancy with one organization; Bill is the first admin via `ADMIN_EMAIL`. Every tracking row is also owned by `user_id`, and RLS lets only that user see it (admins included). | Later users are invited; nobody sees anyone else's shifts | No |
| A03 | Reporting timezone defaults to the device timezone at first launch (fallback `Africa/Dar_es_Salaam`); each session snapshots it at clock-in. | Correct local days while travelling | No |
| A04 | Pay tracking off by default; when on, an hourly rate per session (minor units, TZS default, user-changeable currency). No overtime law assumed. | Earnings card hidden until enabled | No |
| A05 | No reverse geocoding provider (would send coordinates to a third party). Place labels come from remembered places matched by distance on the device. | No street names | No |
| A06 | Push reminders: in-app reminders and local notifications while the app is open in phase 1; server Web Push deferred (needs VAPID keys + cron). | Reminders need the app open/recent | No |
| A07 | Rewards are a pure function of the session history; the ledger is recomputed and reconciled (reversal rows), never hand-edited. | Edits can remove XP; never removes items or levels already unlocked | No |
| A08 | Undo grace after clock-out: 8 seconds; the end time is the tap time. | — | No |
| A09 | Trash keeps deleted sessions for 30 days, then they can be emptied by the user (no silent purge job in phase 1). | — | No |
