---
name: new-feature
description: Add a feature to an app built by the factory — request, assumptions, data, permissions in both layers, API, UI on all widths, tests, PR with handoff. Use when Bill asks for a change or new capability in an existing app.
argument-hint: "<feature request>"
---

> Paths: in an app repo the factory docs are under `docs/factory/` (copied by bootstrap) and the scripts under `scripts/factory/`; in the factory repo they are at the root.

Feature: $ARGUMENTS

Follow the new-feature workflow (factory `workflows/new-feature.md`):
1. Write the request with `intake/FEATURE_REQUEST_TEMPLATE.md` (factory) or inline: who benefits, testable "done", data, permissions, phone behaviour. Record assumptions; ask Bill only if behaviour, security, money or irreversible infra depends on it.
2. Route it (`factory/AGENT_ROUTER.md`): which agents, which files, which migration range (`factory/OWNERSHIP.md`). Mandatory security review if it touches auth, payments, sensitive data, uploads, tenancy, public APIs, webhooks, admin or money.
3. Data: new migration **inside the assigned range**; capabilities changed in `src/lib/permissions.ts` AND `private.role_capabilities()`; `npm run db:local-check`.
4. API: Zod schema → repository → route (`apiSession` → parse → `can` → repo → `{ data }`/`{ error }`) → route tests (signed out, forbidden, invalid, success).
5. UI: primitives only; table desktop / cards phone; drawer; skeleton/empty/error states; destructive via `useConfirm()`; check 375/430/768/1280 light+dark.
6. `npm run check:full`; update `PRODUCT.md`, README, `.env.example`; handoff block in `factory/HANDOFFS.md` and the PR body.
