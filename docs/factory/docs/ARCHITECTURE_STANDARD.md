# Architecture standard

Detail behind [THE_WAY_BILL_MAKES_APPS.md](../THE_WAY_BILL_MAKES_APPS.md) §4–6 and §12. Reference code: [templates/nextjs-supabase](../templates/nextjs-supabase/README.md).
Tags: **[U]** universal · **[P]** preferred default · **[S]** product-specific.

## 1. Shape
- [U] **Modular monolith**: one Next.js app, one Supabase project per environment, one deploy. No microservices, no separate API server.
- [U] Boundaries are folders and interfaces, not network hops.
- [P] One repo per product, created by `scripts/bootstrap` from the template.

## 2. Layers
| Layer | Lives in | May import | Must not | Template example |
| --- | --- | --- | --- | --- |
| Pages / layouts | `src/app/**/page.tsx`, `layout.tsx` | components, `lib/current-user`, repositories via session | Talk to Supabase directly | `src/app/(app)/projects/page.tsx` |
| Route handlers | `src/app/api/**/route.ts` | session, validation, permissions, repositories | Contain business rules inline | `src/app/api/projects/route.ts` |
| Components | `src/components/<feature>/`, `ui/`, `shell/` | `lib/api-client`, `ui/*`, pure `lib/*` | Import `server-only` modules | `src/components/projects/projects-view.tsx` |
| Business rules | `src/lib/<domain>/*.ts` | types only | Read the clock or env directly (take `now`) | `src/lib/<domain>/rules.ts` |
| Data access | `src/lib/data/*` (interface + Supabase + in-memory) | Supabase client passed in | Be called from client components | `src/lib/data/projects.ts` |
| Authorization | `src/lib/permissions.ts` + SQL `has_capability()` | — | Be duplicated as `role === "admin"` | `src/lib/permissions.ts` |
| Validation | `src/lib/validation.ts` (Zod) | — | Live inside components only | `src/lib/validation.ts` |
| Integrations | `src/lib/<provider>/` | log, config | Be called without a disabled/mock mode | `src/lib/email/` |
| Supabase clients | `src/lib/supabase/{server,client,service,env}.ts` | — | Be created ad hoc elsewhere | `src/lib/supabase/` |

## 3. Request pipeline [U]
Every mutating route follows the same order. Copy it, don't reinvent it.

```ts
// templates/nextjs-supabase/src/app/api/projects/route.ts
export async function POST(request: Request) {
  const { session, response } = await apiSession();          // 1. session → 401/403
  if (!session) return response;
  const parsed = createProjectSchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return jsonError(400, firstIssue(parsed.error)); // 2. validate → sentence
  if (!can(session.user, "project:create")) return jsonError(403, "You can't create projects."); // 3. authorize
  const result = await session.projects.create({ ...parsed.data, owner_id: parsed.data.owner_id ?? session.user.id }); // 4. repository (RLS again)
  if (!result.ok) return jsonError(repoErrorStatus(result.error), result.message);
  return NextResponse.json({ data: result.value }, { status: 201 }); // 5. { data }
}
```

| Step | Rule |
| --- | --- |
| Session | [U] `apiSession()` for routes, `requireSession()` for pages (`src/lib/current-user.ts`) |
| Parse | [U] Zod `safeParse`; `.strict()` on PATCH; locked fields refused explicitly |
| Authorize | [U] `can()` or a scoped helper (`canUpdateProject`); load the record first when the rule depends on it |
| Write | [U] Repository running as the user; RLS is the second wall |
| Respond | [U] `{ data }` or `{ error: "Human sentence." }`; status codes per §7 |

## 4. Data boundary [U]
- Route handlers and pages use a **repository interface** (`ProjectRepository`), never `supabase.from()` inline.
- Two implementations: Supabase (runs as the user, RLS) and in-memory (unit/route tests). `tests/projects-route.test.ts` runs real handlers against the in-memory one.
- Multi-row rules → **Postgres function** in one transaction; the repository calls it with `rpc()`.
- [P] Build the UI against the interface first when the backend isn't ready (see `InMemoryProjectRepository`).

## 5. Side effects [U]
- Notifications, emails, pushes, webhooks out: after the response with `after()` from `next/server`; they never fail the request.
- Anything that must happen exactly once (scheduled send, alert) claims a ledger row first ([DATABASE_STANDARD.md](DATABASE_STANDARD.md) §7).

## 6. Next.js 16 specifics [U]
Read `node_modules/next/dist/docs/` before writing framework code; this version differs from older training data.

| Topic | Rule | Template |
| --- | --- | --- |
| Proxy | `src/proxy.ts` (not `middleware.ts`): refresh session with `getClaims()`, redirect signed-out **pages** to `/login?next=`, let `/api/*` answer 401; matcher excludes PWA files | `src/proxy.ts`, `src/lib/public-paths.ts` |
| Cache Components | `cacheComponents: true`; anything reading cookies/session sits behind `<Suspense>`; call `await connection()` before request-time reads | `next.config.ts`, `src/app/(app)/layout.tsx` |
| Loading frames | Suspense fallbacks are same-size frames (`SidebarFrame`, `TopbarFrame`, `BottomNavFrame`) so nothing jumps | `src/components/shell/*` |
| Error boundaries | `error.tsx` / `global-error.tsx` receive `{ error, retry }` (not `reset`); `global-error` renders its own `<html>` | `src/app/(app)/error.tsx`, `src/app/global-error.tsx` |
| Server actions | Only for simple forms (auth). `"use server"` files export async functions only — constants go elsewhere | `src/lib/auth-actions.ts`, `src/lib/auth-rules.ts` |
| Route types | `RouteContext<"/api/x/[id]">`, `LayoutProps<"/">` from `next typegen` (run by `npm run typecheck`) | `src/app/api/projects/[id]/route.ts` |
| Manifest | `src/app/manifest.ts` returns `MetadataRoute.Manifest` | `src/lib/pwa/manifest.ts` |
| Fonts | `next/font/google` Geist (build needs network) | `src/app/layout.tsx` |
| AGENTS.md | Keep the managed `<!-- BEGIN:nextjs-agent-rules -->` block committed; `next dev` re-adds it | `AGENTS.md` |

## 7. Status codes and shapes [U]
| Code | When |
| --- | --- |
| 200 / 201 | `{ data }` (lists: `{ data, total, next_cursor }` when paged) |
| 400 | Validation, unknown field, locked field |
| 401 | Signed out |
| 403 | Signed in but not allowed (or no membership / must change password) |
| 404 | Not found **or not visible** (don't leak existence) |
| 409 | Business rule or uniqueness conflict |
| 503 | Feature not configured — message names the env var to set |

## 8. Client data [P]
- One typed API client (`src/lib/api-client.ts`): every call has a name, one error type (`ApiError` with the server sentence), an offline message.
- No global state library. Server components load; client state is local or a small cache.
- Optimistic UI when the action is frequent (temp ids, optimistic patch, rollback + error). Rare actions just await.
- Realtime revalidates in the background; never a full reload.

## 9. Files and folders [U]
- Files over ~400 lines get a second look; over ~800 must be split.
- Feature folders (`components/<feature>/`), not type folders. Shared UI only in `components/ui/`.
- Config in one place: `src/lib/app-config.ts` (identity, locale), `.env.example` (environment). No magic constants scattered.
- No barrel files that pull server code into client bundles.

## 10. Adding a dependency [U]
Add a package only when all are true:
- [ ] It replaces >100 lines we'd otherwise maintain, or does something security-sensitive we shouldn't write (crypto, PDF, push).
- [ ] Maintained (release in the last 12 months), typed, license MIT/Apache/BSD.
- [ ] Not a second tool for something we already have (one table lib, one date lib, one icon set).
- [ ] Recorded in `factory/DECISIONS.md` if it's a framework-level choice.

## 11. Integrations [U]
Each provider behind `src/lib/<provider>/` with: config reader → mode (`disabled` / `mock` / `live`), a client interface, pure message builders, a store interface for persistence, and webhook parsing separated from handling. See [INTEGRATIONS_STANDARD.md](INTEGRATIONS_STANDARD.md).

## 11b. Replayable writes [U] (simulation 3)
Any create that can be retried (flaky network, double tap, offline queue) carries a client-generated `client_id` (UUID):
| Case | Server answers |
| --- | --- |
| First time | `201 { data }` |
| Same `client_id` again | `200 { data }` with the **original** row (no duplicate); unique index `(organization_id, client_id)` |
| Valid request that conflicts with newer state (e.g. edit after approval) | `409 { error: "Human sentence." }`: the client shows it, never retries |
| Validation error | `400`: the client drops it from its queue and shows the sentence |
Reference: template `POST /api/projects` + `tests/projects-route.test.ts`; offline client: `src/lib/offline/outbox.ts`.

## 11c. Active workspace [P] (simulation 2)
People in several organizations pick one; the choice lives in the `active_org` httpOnly cookie
(`POST /api/session/organization`). `getSessionState()` uses it only while they're still an active member,
else the first membership. RLS still scopes every query; the cookie is a preference, not a permission.
The sidebar's workspace switcher (also in the phone menu sheet) lists memberships and, with SaaS tenancy, "New workspace"
(`/onboarding` → `POST /api/workspaces` → `create_organization()`). Company tenancy shows the plain name.

## 12. Review checklist
- [ ] Route follows the pipeline; no inline Supabase calls in pages/routes
- [ ] New permission exists in `permissions.ts` **and** SQL; test updated
- [ ] Business rule is a pure function with a test; SQL enforces the invariant if it's "must never break"
- [ ] Side effects in `after()`; exactly-once effects claim a ledger row
- [ ] Session reads behind Suspense; `connection()` before time/cookie reads
- [ ] New env var in `.env.example` with a class tag
- [ ] No file grew past ~800 lines; no new dependency without the §10 checks

Related: [DATABASE_STANDARD.md](DATABASE_STANDARD.md) · [SUPABASE_STANDARD.md](SUPABASE_STANDARD.md) · [SECURITY_STANDARD.md](SECURITY_STANDARD.md) · [../checklists/backend.md](../checklists/backend.md)
