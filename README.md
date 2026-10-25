# SHIFTY

A personal, session-first work tracker. Tap **Clock in**, take breaks, clock out — one session even when it runs
from Monday evening to Tuesday morning — and see every hour split exactly onto the calendar days it touched.
Beautiful insights, and Mochi, a companion who rewards steady logging and rest (never long hours).

Product truth: [PRODUCT.md](PRODUCT.md) · brief and assumptions: [factory/BRIEF.md](factory/BRIEF.md) ·
decisions: [factory/DECISIONS.md](factory/DECISIONS.md) · schema: [docs/SCHEMA.md](docs/SCHEMA.md) ·
PWA support: [docs/PWA_SUPPORT.md](docs/PWA_SUPPORT.md) · iOS Live Activities: [docs/LIVE_ACTIVITIES.md](docs/LIVE_ACTIVITIES.md).

## How it works
| Layer | Where | Rule |
| --- | --- | --- |
| Time engine | `src/lib/time/` | Instants are epoch ms (UTC). Day boundaries come from the zone's real wall clock (DST, skipped/repeated midnight); Σ day allocations = session net, exactly |
| Session rules | `src/lib/shifts/reducer.ts` | One pure state machine for device **and** server: clock in/out, breaks, corrections (reason + revision), manual entry, trash, import |
| Device store | `src/lib/store/` | Durable IndexedDB event log with device UUIDs, folded by the reducer; works offline, survives app kills; sync pushes in order, never overwrites silently ("Needs attention") |
| Sync API | `src/app/api/sync/*` | Re-runs the reducer, commits atomically via `commit_shift_event()`; RLS = own rows only |
| Database | `supabase/migrations/0100–0105` | One active session per user (partial unique index), non-overlapping breaks inside the session, append-only event log, owner-only access |
| Reports | `src/lib/reports/` | "Allocate to calendar days" and "Group by session start date"; both reconcile to the same total |
| Rewards | `src/lib/rewards/` | Deterministic, idempotent XP ledger; levels and items never go down; no XP for long hours |
| UI | `src/app/(app)/`, `src/components/` | Home · Sessions · Insights · Companion · Settings; `/design` is the living style guide |

**Device mode.** Without Supabase configured (or signed out), everything works on this device and says so
("On this device"). With SHIFTY's own Supabase project configured, sign in to sync across devices.
**Demo:** open `/?demo=1` for ten weeks of generated shifts (memory only, nothing saved); `/?demo=0` leaves.

## Run locally
```bash
npm ci
npm run dev                      # http://localhost:3000 — works with no env at all (device mode)
```
With sync (SHIFTY's **own** Supabase project — never another product's):
```bash
cp .env.example .env.local       # fill NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ACCESS_TOKEN, ADMIN_EMAIL
npm run db:migrate               # applies supabase/migrations over HTTPS (Management API)
ADMIN_EMAIL=you@example.com ORG_NAME="SHIFTY" npm run db:configure
npm run db:check-rls             # live proof: nobody else sees your shifts
```
Sign up with `ADMIN_EMAIL` and confirm the email; the first confirmed sign-in claims Admin.

## Checks
| Command | What |
| --- | --- |
| `npm run check` | lint + typecheck + unit tests (time engine fixtures A–O, reducer, store, sync routes, rewards, reports, PWA) |
| `npm run check:full` | + production build |
| `npm run db:local-check` | migrations + RLS + commit function on a throwaway local Postgres 16 |
| `npm run test:e2e` | Playwright journeys at 1280 / 375 / 430 against `E2E_BASE_URL` |
| `npm run db:check-rls` | the same RLS proof against the real project |

## Deploy (Vercel)
| Step | Command / place |
| --- | --- |
| Project | Vercel project `shifty` (region `dub1`) is linked to this repo; every push builds a preview |
| Env (preview + production) | Vercel → shifty → Settings → Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public), `SUPABASE_SERVICE_ROLE_KEY` (secret), `ADMIN_EMAIL`. None are needed for device mode |
| Supabase Auth | Site URL + redirect URLs = the deployment URL; custom SMTP before inviting anyone |
| Release | `scripts/factory/release preflight` → `migrate` → `verify` (see `scripts/factory/release --help`) |
| Verify | `scripts/factory/verify-production <url>` |

## Support matrix (honest)
| Capability | iPhone Safari tab | iPhone home-screen app | Android Chrome (installed) | Desktop Chrome / Safari / Firefox |
| --- | --- | --- | --- | --- |
| Clock in/out, breaks, live timer | ✓ | ✓ | ✓ | ✓ |
| Timer correct after sleep / kill / reboot | ✓ (timestamps) | ✓ | ✓ | ✓ |
| Offline launch + offline clock actions | ✓ after first visit | ✓ | ✓ | ✓ |
| Point-in-time location (asked at clock-in/out only) | ✓ with permission | ✓ | ✓ | ✓ |
| Reminders (notifications) | ✗ (iOS needs the installed app) | ✓ while recently open, iOS 16.4+ | ✓ while open | ✓ while open |
| App icon badge while working | ✗ | ✓ | varies | Chrome/Edge |
| Background sync | ✗ — syncs when you open the app | ✗ — same | partial | partial |
| Lock-screen Live Activity / Dynamic Island | ✗ — impossible for web apps | ✗ | n/a | n/a |

Live Activities need a native app; see [docs/LIVE_ACTIVITIES.md](docs/LIVE_ACTIVITIES.md) (8 h active limit, 16 h shift strategy).
Not yet tested on a real iPhone or Android device; the checklist is in [docs/PWA_SUPPORT.md](docs/PWA_SUPPORT.md).

## Layout
| Path | Purpose |
| --- | --- |
| `src/lib/time/`, `src/lib/shifts/`, `src/lib/reports/`, `src/lib/rewards/` | Pure domain (unit-tested) |
| `src/lib/store/`, `src/lib/sync/`, `src/lib/geo/`, `src/lib/export/`, `src/lib/demo/` | Device store, sync client, location capture, export/import, demo data |
| `src/app/api/sync/`, `src/lib/data/shifts*.ts` | Server sync + repository (Supabase and in-memory twin) |
| `src/components/{home,sessions,insights,companion,settings,mochi,sync,pwa}` | Screens and the mascot |
| `src/components/ui/`, `src/components/shell/` | Design-system primitives and the app shell |
| `public/sw.js` | Service worker: app shell + static assets only; never API responses or other origins |
| `supabase/migrations/` | Template foundation 0001–0004, SHIFTY 0100–0105 |
| `factory/` | Brief, blueprint, decisions, task graph, ownership, handoffs, state |
