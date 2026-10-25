# OWNERSHIP — SHIFTY

> Who may edit what, so parallel lanes never collide. The orchestrator assigns; nobody edits outside their row.

## File ownership
| Lane / agent | Owns (may edit) | Must not edit |
| --- | --- | --- |
| orchestrator | `src/lib/time/**`, `src/lib/shifts/**`, `src/lib/reports/**`, `src/lib/store/**`, `src/lib/sync/contract.ts`, `src/lib/sync/transport.ts`, `src/lib/geo/**`, `src/lib/format.ts`, `factory/**` | — |
| ux (ux-architect) | `src/app/globals.css`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/(auth)/layout.tsx`, `src/components/ui/**`, `src/components/shell/**`, `src/components/theme/**`, `src/lib/nav.ts`, `src/lib/theme.ts`, icons/manifest colours, `src/app/(app)/design/**` | domain, API, DB |
| mochi (frontend-engineer) | `src/components/mochi/**`, `tests/mochi-catalog.test.ts` | everything else |
| db (database-engineer) | `supabase/migrations/0100–0199`, `supabase/local/**`, `scripts/check-rls.ts`, `src/lib/permissions.ts`, `tests/permissions.test.ts`, `tests/migrations.test.ts`, `docs/SCHEMA.md` | `src/**` except permissions |
| rewards (backend-engineer) | `src/lib/rewards/**`, `tests/rewards*.test.ts` | everything else |
| sync (backend-engineer) | `src/app/api/sync/**`, `src/lib/data/shifts*.ts`, `src/lib/data/account.ts`, `src/app/api/account/**`, `src/proxy.ts`, `src/lib/public-paths.ts`, `src/lib/supabase/env.ts`, `.env.example`, `tests/sync-*.test.ts` | domain, UI |
| home / sessions / insights / companion-settings (frontend-engineer) | their route folders under `src/app/(app)/` and `src/components/<feature>/**` | shared primitives (request from ux) |
| pwa (pwa-mobile-engineer) | `public/sw.js`, `public/offline.html`, `src/components/pwa/**`, manifest | feature screens (report findings) |

## Migration number ranges
| Range | Owner | Purpose |
| --- | --- | --- |
| 0001–0009 | template | foundation (exists) |
| 0100–0199 | database-engineer | SHIFTY schema, RLS, commit function |
| 0200–0299 | reserved | phase 2+ (push subscriptions, schedules) |

## Single owners
| Shared file | Owner |
| --- | --- |
| `src/lib/shifts/reducer.ts` (all session rules) | orchestrator |
| `src/lib/permissions.ts` + SQL mirror | database-engineer |
| `src/components/ui/**` | ux-architect |
