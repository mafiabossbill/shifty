# Frontend checklist

For every UI change. Standard: [../docs/UI_UX_STANDARD.md](../docs/UI_UX_STANDARD.md). Pair with [responsive.md](responsive.md).

## System
- [ ] Colors only from tokens in `src/app/globals.css` (no raw hex in components: `grep -rn "#[0-9a-fA-F]\{6\}" src/components` returns only documented exceptions)
- [ ] Shared primitives used: `Button`, `useConfirm()`, `StatusPill`, `Skeleton`, `EmptyState`, `Dialog`, `Sheet` from `src/components/ui/` (no one-off copies)
- [ ] One primary (`default`) button per area; destructive actions use `variant="destructive"` behind `useConfirm()`
- [ ] Icon-only buttons have `aria-label`
- [ ] Color carries meaning only (status, danger, success); no gradients, no decorative color

## States
- [ ] Loading: skeleton frames the same size as the loaded UI; no full-screen spinner
- [ ] Empty: one sentence + one action (`EmptyState`)
- [ ] Error: human sentence saying what to do; failed mutations roll back optimistic changes and show the error
- [ ] Route segment has `error.tsx` (props `{ error, retry }` in Next 16) or is covered by the `(app)` one

## Data and forms
- [ ] Browser talks to the API only through the typed client (`src/lib/api-client.ts`); no ad-hoc `fetch`
- [ ] Client-side checks mirror the Zod schema messages; the server stays the authority
- [ ] Filters, tabs and open records live in the URL (shareable, back button works)
- [ ] Forms: labels tied to inputs, autocomplete attributes, Enter submits, pending state disables submit
- [ ] Lists over ~200 rows virtualized or paged (TanStack Table v9 + react-virtual for grids)

## Behaviour
- [ ] No full page reloads after mutations; background revalidation (`router.refresh()` / realtime)
- [ ] Keyboard: Tab order sensible, Esc closes overlays, focus returns to the trigger
- [ ] Drawers keep the list's scroll position; Esc and outside click close
- [ ] Controls the viewer can't use are hidden (derived booleans), and the server refuses them anyway

## Verify
- [ ] `npm run check` green
- [ ] Viewed in light and dark at 375, 430, 768, 1280 ([responsive.md](responsive.md))
- [ ] Changed flow tried on the preview deployment
