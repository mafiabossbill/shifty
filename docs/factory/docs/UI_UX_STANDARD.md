# UI/UX standard

Detail behind [THE_WAY_BILL_MAKES_APPS.md](../THE_WAY_BILL_MAKES_APPS.md) §13, §15–16. Reference: `templates/nextjs-supabase/src/app/globals.css`, `src/components/ui/`, `src/components/shell/`.
Tags: **[U]** universal · **[P]** preferred default · **[S]** product-specific.

## 1. Character
Modern, premium, calm, understated, dense when needed, mobile-aware. Users understand it without training.

| Learn from | Take | Don't take |
| --- | --- | --- |
| **Attio** | Near-white surfaces, quiet borders, records in side panels, typography doing the hierarchy | Their brand colors |
| **Linear** | Speed, keyboard-first, ⌘K, compact controls, restrained motion | Dark-by-default |
| **Airtable** | Saved views, column chooser, grouping, filter builder | Rainbow field colors |
| **Monday / Productive / Smartsheet** (selectively) | Board for status flow, resource/workload views, Gantt with dependencies | Colorful cells, card walls, enterprise chrome |

[U] Bill dislikes: rainbow UI, big gradients, cards everywhere, heavy rounding/shadows, huge type, gimmicky animation, generic AI-SaaS look, decorative dashboards, Excel ugliness, old enterprise look.

## 2. Tokens [U]
- Every color is a CSS variable in `globals.css`; components use semantic tokens (`bg-background`, `text-muted-foreground`, `border`) or the neutral/status scales, **never raw hex**.
- Color is reserved for meaning: status, danger, success, focus, links in prose. The brand accent appears in the logo mark and focus, rarely elsewhere.

| Token | Light | Use |
| --- | --- | --- |
| `--background` | white | Page and table surfaces |
| `--border` | oklch 0.925 | Hairlines, dividers (1px) |
| `--sidebar` | oklch 0.985, faintly warm | Sidebar only |
| `--muted` / `--muted-foreground` | 0.97 / 0.54 | Secondary surfaces / secondary text |
| `--primary` | near-black | Primary button, selected states |
| `--destructive-strong` | red 0.577 | Fills behind white text (AA in both themes) |
| `--overlay` | black 25% | Dialog backdrop (subtle 5% for sheets) |

## 3. Dark mode [P]
- Light / Dark / System; class `.dark` on `<html>` set by an inline script **before first paint** (`src/lib/theme.ts`), synced by `ThemeProvider` (`useSyncExternalStore`, no setState-in-effect).
- Dark ink `#0c0e15` = background = status-bar/splash color (`THEME_COLORS`).
- **Scales flip in dark** (Radix-style): step 50 is always the faintest tint, 700+ the strongest ink, so `bg-red-50 text-red-700` reads right in both themes. Copy the `.dark` block of `globals.css` as is.
- [U] AA contrast in both themes: body ≥ 7:1, muted ≥ 4.5:1, status ink ≥ 4.5:1 on its pill.
- [P] PDFs stay light.

## 4. Typography [U]
| Context | Desktop | Phone (<768px) |
| --- | --- | --- |
| Body / table cells | 13px, line-height 20px | 15px |
| Small labels, meta | 11–12px | 13px |
| Bottom-bar labels | 10.5px | 10.5px (five tabs share 360px) |
| Section title | 13–15px semibold | 17–19px |
| Page title | 15–16px semibold | 19–20px |
| Inputs | 13px | **≥16px** (no iOS zoom) |
- Font: Geist / Geist Mono [P] (Inter acceptable). Hierarchy by weight and color, not size. `tabular-nums` for numbers in tables.

## 5. Spacing, shape, elevation [U]
- Spacing on a 4px grid; page padding 16px phone / 24px desktop; table rows 32–36px desktop.
- Radius: `--radius: 0.5rem`; pills `5px`; sheets `rounded-t-xl` on phones only.
- Shadows: `shadow-xs` on buttons, `shadow-lg` on floating dialogs; nothing else. No gradients.
- Motion: 150–200ms fades/slides for overlays only; `prefers-reduced-motion` turns them off.

## 6. Buttons [U]
| Variant | Use | Rule |
| --- | --- | --- |
| `default` | The primary action of a view or dialog (New, Save, Approve) | One per area |
| `secondary` | Supporting action with weight (Restore, Rename) | — |
| `outline` | Toolbar controls, row actions (Filter, Columns, Export, View) | — |
| `ghost` | Low-emphasis or dense (Clear, Discard, icon close) | — |
| `destructive` | Delete / Remove / Archive / Deactivate | Always behind `useConfirm()` |
| `link` | Navigation inside prose only | Never for actions |

| Size | Desktop | Phone | Use |
| --- | --- | --- | --- |
| `default` | 32px | 40px | Forms, dialogs |
| `sm` | 28px | 36px | Toolbars |
| `xs` | 24px | 32px | In-row actions |
| `icon*` | 24–32px | 32–40px | Icon-only (needs `aria-label`) |
- [U] Every action is a real `<Button>`; touch hit area ≥44×44px via the `::after` rule in `globals.css`.

## 7. Status pills [U]
Tinted background + dot + label, one tone map per product (`src/components/ui/status-pill.tsx`):

| Tone | Classes | Typical meaning |
| --- | --- | --- |
| neutral | `bg-neutral-100 text-neutral-600` | Not started, planned, cancelled |
| info | `bg-blue-50 text-blue-700` | In progress, active |
| warning | `bg-amber-50 text-amber-800` | Waiting, on hold, due soon |
| danger | `bg-red-50 text-red-700` | Blocked, overdue, failed |
| success | `bg-emerald-50 text-emerald-700` | Done, approved, paid |
| [S] review | `bg-violet-50 text-violet-700` | Review (a task status) |

## 8. Layout patterns
| Pattern | Desktop / tablet | Phone | Reference |
| --- | --- | --- | --- |
| [P] App shell | Sidebar 224–240px + top bar 50px | Top bar + **bottom bar** (≤4 tabs + More sheet) | `src/components/shell/*` |
| [U] Lists | Dense table, sticky header | Stacked cards (title, status, owner/date, one key value) | `projects-view.tsx` |
| [P] Wide grids | Table | Same table scrolling sideways **inside its own box** (never the page) | — |
| [U] Record detail | Right **drawer** (sheet); list keeps its place | Full-width sheet | `projects-view.tsx` `ProjectDrawer` |
| [U] Dialogs | Centered, max 480–512px | **Bottom sheet**, scrolls, safe-area padding | `src/components/ui/dialog.tsx` |
| [U] Confirm | Shared `useConfirm()`; focus on Cancel; names the thing | Same | `src/components/ui/confirm-dialog.tsx` |
| [P] Settings | Grouped side nav ≥1024px | Menu page + back links | — |
| [P] Dashboards | Numbers that link to their rows; charts only for trends | Section buttons, larger type | `dashboard/page.tsx` |

## 9. Tables [P]
- Search + quick filters in the URL; saved views (private / team / org); column show/hide/reorder/resize; sort; group; bulk select with safe bulk edits; CSV export of visible columns.
- Virtualize past ~200 rows (`@tanstack/react-virtual`); keyset paging from the API.
- Row click or Enter opens the drawer; ↑/↓ move; Esc closes; `X` selects.
- Empty cell = "—"; money right-aligned with tabular numbers; dates "22 Oct 2026".

## 10. Forms [U]
- Labels above fields; required fields enforced by the **same list** on client and server.
- Validation: client shows the first problem inline under the form (`role="alert"`), server returns the same sentence. Never only a red border.
- Save model: dialogs and drawers use Save (enabled only when dirty); preferences save on change (segmented controls, toggles) [P].
- Date/time fields: native pickers; empty pickers look like placeholders (`input.tsx`).

## 11. States [U]
| State | Rule |
| --- | --- |
| Loading | Skeleton outline of the real layout (`PageLoading`); never a full-screen spinner; no layout shift |
| Empty | One sentence of what appears here + one action (`EmptyState`); no illustrations |
| Error (page) | `error.tsx`: what happened in plain words, "Try again" (`retry`), reassurance nothing was lost |
| Error (action) | Inline sentence for forms; toast for background actions **that persists** somewhere the user can find it (e.g. a Problems list in the bell) |
| Offline | `offline.html`: "needs a connection; nothing saved was lost" |
| Read-only | Hide edit controls for roles without the capability; say "You can view this" |

## 12. Navigation and speed [P]
- ⌘K command palette: search records + jump to pages; `?` shortcuts sheet.
- No full reloads: background `router.refresh()`, realtime revalidation, prefetched sign-out, optimistic writes.
- Role homes: each role lands where its daily work is (e.g. admins Overview, staff My Work, executives a read-only summary).

## 13. Copy and tone [U]
- Short, plain sentences in the user's words. Buttons are verbs ("Create project", "Post update").
- Errors say what to do: "Give the project a name." not "Validation failed".
- Confirmations name the object and the consequence: "Delete Website relaunch? The audit log keeps a record."
- No jargon (no "entity", "record id", "sync"), no exclamation marks, emoji only where the culture expects it ("Karibu tena 👋").
- Numbers: `TSh 1,250,000` style per org currency; never relabel stored currency.

## 14. Accessibility [U]
- AA contrast in both themes; focus ring visible (`focus-visible:ring-[3px]`); every icon button has `aria-label`.
- Dialogs/sheets have titles (sr-only if visual title elsewhere); `role="alert"` for errors; `aria-current="page"` in nav.
- Keyboard: all actions reachable; Esc closes; focus returns to the trigger.

## 14b. Charts and KPI tiles [P] (simulation 2)
- Default library: **Recharts** (only when a chart is needed). A chart earns its place by answering a trend question; otherwise a number or a table.
- KPI tile: label (12px muted) · value (20px, tabular numbers) · delta vs previous period with sign and colour only for good/bad · links to the rows behind it.
- One neutral series colour + one accent; status colours only for status; no gradients, 3D, donut-for-everything, or legends that repeat the axis.
- Money in charts uses the same formatter as tables (minor units converted once, currency shown).

## 15. Design review checklist (every UI PR)
- [ ] Checked at **375, 390, 430, 768, 1024, 1280**, light and dark ([../checklists/responsive.md](../checklists/responsive.md))
- [ ] No page-level sideways scroll; targets ≥44px; inputs ≥16px on phones; safe areas on bars and sheets
- [ ] Only tokens; color only for meaning; at most one primary button per area
- [ ] Tables on desktop, cards on phones; detail opens in a drawer
- [ ] Loading skeleton, empty state, error state all exist and read well
- [ ] Destructive actions confirm and name the object
- [ ] Copy reads like a person; errors say what to do
- [ ] Nothing decorative: every chart, number and color answers a question

Related: [PWA_STANDARD.md](PWA_STANDARD.md) · [../checklists/frontend.md](../checklists/frontend.md) · [../workflows/ui-redesign.md](../workflows/ui-redesign.md)
