# Responsive checklist

Never desktop-shrunk. Check every changed screen at each width in **light and dark**. Standard: [../docs/UI_UX_STANDARD.md](../docs/UI_UX_STANDARD.md).
How: Playwright projects (`desktop`, `phone-375`, `phone-430`) + browser devtools device mode, or a screenshot sweep (`scripts/ui-sweep.mjs` pattern in TESTING_STANDARD).

| Width | Device class |
| --- | --- |
| 375 | Small phone (iPhone SE/mini) |
| 390 | Standard phone |
| 430 | Large phone |
| 768 | Tablet portrait (sidebar appears at `md`) |
| 1024 | Tablet landscape / small laptop |
| 1280+ | Desktop |

## Navigation
- [ ] < 768px: bottom bar visible (≤4 tabs + More), sidebar hidden; More opens the full nav as a sheet
- [ ] ≥ 768px: sidebar visible, bottom bar hidden
- [ ] Active item obvious; page title in the top bar at every width

## Layout
- [ ] No page-level sideways scroll: `document.documentElement.scrollWidth - clientWidth <= 0` (e2e smoke asserts it)
- [ ] Dense tables become stacked cards on phones (or a wide grid scrolls inside its own box with the key column visible)
- [ ] Long text truncates or wraps without breaking the layout (names, titles, emails)
- [ ] Sticky headers/footers don't cover content; bottom content clears the bottom bar (`--bottom-nav-height`)

## Overlays
- [ ] Dialogs are bottom sheets on phones, centered from `md`
- [ ] Drawers full-width on phones, side sheets from `sm`
- [ ] Overlays scroll internally; close buttons reachable; Esc works on desktop

## Touch and input
- [ ] Every interactive element has a ≥44×44px hit area on touch screens (`[data-slot=button]`, `[data-touch-target]`)
- [ ] Inputs/selects/textareas are ≥16px on phones (no iOS zoom on focus)
- [ ] Correct keyboards: `type="email"`, `inputMode="numeric"`, `autoComplete` set
- [ ] On-screen keyboard doesn't hide the focused field or the submit button (Android `interactiveWidget: resizes-content`)
- [ ] Pressed states visible (`active:`); no hover-only affordances

## Installed app / safe areas
- [ ] Top bar, bottom bar, sheets and toasts respect `env(safe-area-inset-*)` (`pt-safe`, `pb-safe`, `px-safe`)
- [ ] Landscape on a notched phone: content not under the notch
- [ ] No rubber-band/pull-to-refresh of the whole shell (`overscroll-behavior`)

## Themes
- [ ] Light and dark both readable (status pills, borders, muted text, charts)
- [ ] Theme applied before first paint (no flash on reload)

## Evidence
- [ ] Screenshots or e2e run noted in the handoff with the widths checked
