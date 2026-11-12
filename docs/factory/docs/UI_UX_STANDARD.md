# UI/UX standard

How every screen is designed, built and checked. Detail behind [THE_WAY_BILL_MAKES_APPS.md](../THE_WAY_BILL_MAKES_APPS.md) §13, §15–16.
What to build and for whom comes first: [PRODUCT_DISCOVERY_STANDARD.md](PRODUCT_DISCOVERY_STANDARD.md).
The system lives in the app: tokens in `src/app/globals.css`, primitives in `src/components/ui/`, shell in `src/components/shell/`, all of it visible at `/design` in development.

Sources: *Refactoring UI* (RUI), *Practical UI* (PUI), *Designing Interfaces* 3rd ed. (DI), *UX for Business* (UXB), *Continuous Discovery Habits* (CDH).
Tags: **[U]** universal · **[P]** preferred default · **[S]** product-specific. Where two books disagree, the stricter rule for a work tool used all day is the one written here.

| Enforced by | What |
| --- | --- |
| `npm run design:check` (inside `npm test`, so the Stop hook and CI block on it) | §17: sizes, weights, spacing, colours, shadows, corners, capitals, motion |
| `tests/design.test.ts` | Every signed-in screen has a gallery page (or a written reason) |
| `npm run design:shots` + [../checklists/design-review.md](../checklists/design-review.md) | Everything a script cannot judge: hierarchy, grouping, wording, states. Looked at, at 375 and 1280, light and dark |

## 1. Character
Calm, plain, exact. A person understands the screen without training and can use it all day without tiring (DI). Finish is a trust signal: a product that looks careless is assumed to be careless (DI). Every element has a reason a user would care about; anything without one is removed (PUI).

| Learn from | Take | Don't take |
| --- | --- | --- |
| **Attio** | Near-white surfaces, quiet borders, records in side panels, type doing the hierarchy | Their brand colours |
| **Linear** | Speed, keyboard first, ⌘K, restrained motion | Dark by default |
| **Airtable** | Saved views, column chooser, grouping, filter builder | Rainbow field colours |

### The tells of a generated interface [U]
Each of these is banned. The first column is what a reviewer sees; the script catches the ones marked ✓.

| Tell | Instead | ✓ |
| --- | --- | --- |
| A coloured glow, a gradient wash, a dark purple or blue "AI" theme | Flat near-white (or near-black) surfaces; colour only where it means something | ✓ |
| Cards inside cards; every group in its own rounded box | Group with space and alignment first; a box only around a distinct object or region (PUI, DI) | |
| Tiny capital-letter labels with wide spacing above everything | Sentence case at normal spacing; a small grey caption if a label is needed at all | ✓ |
| Everything bold, or five different weights | Two weights; most text is regular | ✓ |
| A dozen font sizes one pixel apart | Seven sizes, each with one job | ✓ |
| Grey text too faint to read; text faded with opacity | `text-muted-foreground` and nothing lighter | ✓ |
| Several accent colours; coloured icons, headings and badges for decoration | One action colour; status colours only for status | ✓ |
| A big red delete button on an ordinary screen | Delete is a quiet button until the confirm step (RUI, PUI, UXB) | |
| Charts, rings, gauges and counters that answer no question | A number that links to its rows; a chart only for a trend (DI, UXB) | |
| `Label: value` pairs stacked everywhere | Drop the label when the value explains itself; merge it into a phrase ("12 left") (RUI) | |
| Emoji as icons, sparkles, mascots, exclamation marks | One icon set, labelled; plain words | ✓ |
| Centred paragraphs; a hero heading on a work screen | Left-aligned; small titles inside the app | ✓ |
| Giant padding everywhere, or everything crammed edge to edge | The spacing scale, chosen by how related two things are | ✓ |
| Placeholder text instead of a label | A visible label above every field | |
| Controls for things that do not exist yet | Nothing is shown that is not built (RUI) | |

## 2. How a screen gets designed [U]
Design is done before code, in this order. Nothing here needs a design tool; it needs writing and looking.

### 2.1 Screen plan (in the blueprint, one row per screen; the ux-architect writes it)
| Field | Rule |
| --- | --- |
| Purpose | The one thing a person should get done here if they do nothing else. A screen exists because of a task, never because similar products have one (UXB) |
| Who arrives, from where, knowing what | Design from what the user knows at that moment, not what the builder knows (UXB) |
| Screen type | Overview (many things) · Focus (one thing) · Make (create or edit) · Do (one task). Each type is designed once and reused (DI) |
| Primary action | At most one. If no action clearly wins, there is no primary button (PUI) |
| Content, ranked | Primary, secondary, tertiary. Most of the design work is quietening the last two (RUI) |
| Pattern | From §10–11: which list, which navigation, which container |
| States | Empty, loading, error, one item, many items, longest and shortest content, no permission |
| Phone | What changes below 768px, and what a phone user does not need at all (DI, UXB) |
| Next step | Where the person goes after finishing. Never a dead end (DI, UXB) |

### 2.2 Flow plan (one per flow that creates or changes something)
Steps in order · every question justified as a cost · required before optional, most valuable first · what is remembered for next time · where it can be left and resumed · what is confirmed at the end and what happens next (UXB, DI).

### 2.3 Order of work
1. Start from a feature and its content, not from the shell. Navigation is settled once several features exist (RUI).
2. Structure first: what is on the screen and in what order. It must read in grey, before any colour (RUI, PUI).
3. Choose every value from the system (§4–7). If the same small decision comes up twice, it becomes part of the system (RUI).
4. Phone layout first, then widen and fix only what feels cramped (RUI, PUI, UXB).
5. Design the empty, loading and error states with the screen, not after it (RUI).
6. Build it, add it to the gallery, run `npm run design:shots`, **open the images and look**. Fix what you see. A screen nobody looked at is not finished.
7. Squint test: blur the screenshot or view it small. The purpose of the screen and its main action must still be obvious (PUI).

## 3. Hierarchy [U]
- Three levels per screen. Decide which content is primary and make the rest quieter; when the main thing does not stand out, tone down its neighbours instead of making it louder (RUI).
- Weight and colour before size. Size alone gives huge titles and unreadable captions (RUI).
- Three text colours: `text-foreground`, `text-muted-foreground`, and nothing fainter (§6).
- Page and section titles inside the app are small (`text-title`). They are labels for the content, not the content (RUI).
- Displayed data is not `Label: value` by default. Drop the label when format or context makes it obvious, merge it into the value, or keep it and make it the quiet part. In a spec sheet people scan for the label, so there the label is the darker part (RUI).
- Icons beside text take a softer colour than the text; they are visually heavy (RUI, PUI).
- A few focal points per screen. Each extra one weakens the others (DI).
- The most valuable action and information come first: top, first in order, fewest clicks from the default screen. Scrolling is navigation; what is far down is seen by fewer people (UXB).
- Reading order is top to bottom, left to right; the action comes after what must be read to decide (DI, UXB).

## 4. Layout and space [U]
### Spacing scale
Only these steps exist (`p-`, `m-`, `gap-`, `space-`). Neighbours differ enough to see, so choosing is picking between two candidates, not tuning (RUI, PUI).

| Step | px | Use |
| --- | --- | --- |
| `0.5` `1` | 2, 4 | Inside a control; icon to label |
| `1.5` | 6 | Label to its field |
| `2` | 8 | Items in one group |
| `3` | 12 | Inside a row or a small box |
| `4` | 16 | Between fields; page edge on phones |
| `6` | 24 | Between groups; page edge on desktop |
| `8` | 32 | Between sections |
| `12` `16` `20` `24` | 48–96 | Between parts of a page |

- **Space shows what belongs together.** Always less inside a group than around it: label to field less than field to field; more above a section title than below it. Equal spacing everywhere hides the structure and causes mistakes (RUI, PUI).
- Start with more space than seems needed, then tighten. Dense is a choice made on purpose for a screen that must show a lot (RUI).
- Group by closeness, likeness and alignment first. A box is the strongest grouping and the noisiest: use it for the page's main regions and for distinct objects, never nested, never around every group (PUI, DI).
- Give content the width it needs and no more. A form is 24–32rem wide whatever the screen; reading text is at most 70 characters a line (`max-w-prose`); the sidebar has a fixed width; only the main work area flexes (RUI).
- A narrow thing lost in a wide page is split into columns (form beside its explanation), not stretched (RUI).
- One alignment per component, left by default. Text and its icon share one left edge; mixed sizes on one line sit on the baseline (PUI, RUI).
- Nothing touches the edge of its box, a border, or another element (DI).
- Controls of one tool stay together, next to what they act on (DI, PUI).
- The screen cannot break: test with the longest and the shortest real value, a large number, an empty value. Wrap or shrink before clipping; truncate where the difference is not lost (PUI, DI). The gallery's sample data is written for this.

## 5. Type [U]
One typeface (Geist, `font-sans`); `font-mono` for code and identifiers only. Two weights: `font-normal` and `font-semibold`.

| Class | Desktop | Phone | Job |
| --- | --- | --- | --- |
| `text-display` | 28 / 32 | 28 / 32 | A key number |
| `text-heading` | 22 / 28 | 22 / 28 | The one headline of a focused page (sign-in, onboarding, an empty state) |
| `text-prose` | 18 / 28 | 18 / 28 | Text that is read: descriptions, help, legal. Max 70 characters a line |
| `text-title` | 16 / 24 | 18 / 26 | Page and section titles, with `font-semibold` |
| `text-body` | 14 / 20 | 16 / 24 | Interface text: controls, table cells, lists |
| `text-caption` | 12 / 16 | 13 / 18 | Meta, hints, table headers. Nothing else is smaller |
| `text-micro` | 11 / 16 | 11 / 16 | Phone tab-bar labels only |

- Sizes are hand-picked whole pixels, and no other size can be written: Tailwind's own (`text-sm`, `text-xl`…) are switched off (RUI, PUI).
- Line height falls as size rises (1.6 for prose, 1.15 for a display number) (RUI, PUI).
- Left-align. Centre only a heading or a block of one or two lines; never justify (RUI, PUI, DI).
- Numbers in tables are right-aligned with `tabular-nums` (RUI).
- Sentence case everywhere: headings, buttons, labels, menus. No capital-letter labels, no added letter spacing; `tracking-tight` only on `text-heading` and `text-display` (PUI, RUI).
- Links inside text are underlined. Where nearly everything is a link (a table of names), weight or the row's hover marks it instead (RUI, PUI).
- [P] A second typeface for headings is a brand decision recorded in `factory/DECISIONS.md`, never a default (PUI).

## 6. Colour [U]
Greys do the work. Colour appears only where it means something: an action, a status, an error, a selection. Design reads correctly in grey first (RUI, PUI).

| Token | Job | Contrast |
| --- | --- | --- |
| `--foreground` | Text, labels, headings. Dark grey, never pure black | ≥ 7:1 |
| `--muted-foreground` | Secondary text. The lightest text there is | ≥ 4.5:1 |
| `--primary` | **The action colour**: the primary button, a selected state. Nothing that is not an action or selection uses it | label ≥ 4.5:1 |
| `--control` | Edge of a field, checkbox or select: a border that carries meaning | ≥ 3:1 |
| `--border` | Dividers and outlines that only decorate. May be faint; removing one must not hurt (PUI) | — |
| `--muted`, `--accent` | A quieter surface, a hover | — |
| `--background`, `--card` | Page and raised surfaces | — |
| status scales | `blue` in progress · `amber` waiting · `red` problem · `emerald` done · `violet` review [S] · `neutral` inactive | ink ≥ 4.5:1 on its tint |

- One action colour. A second accent needs a reason written in `factory/DECISIONS.md`. The brand colour is the logo's; it does not tint the interface (PUI).
- Status colour is never the only signal: pair it with a word, an icon or a dot-and-label. Same for selection, errors and chart series (RUI, PUI, DI).
- Coloured elements that are not the point of the screen use dark ink on a light tint (a status pill), not white on a strong fill (RUI).
- On a coloured surface, never grey text and never white at reduced opacity: pick an ink of the same hue (RUI).
- No raw hex or `rgb()` in components; no Tailwind palette outside the neutral and status scales. A missing colour is added to `globals.css` as a token with a job (RUI: fix the shades up front, never derive on the fly).
- No gradients, glows or decorative backgrounds in the app [P] (Bill's rule; RUI allows subtle ones on marketing pages, which need a `design-ok` note).

### Dark mode [P]
- Light / Dark / System; `.dark` on `<html>` set before first paint (`src/lib/theme.ts`).
- Scales flip (Radix-style): step 50 is always the faintest tint, 700+ the strongest ink, so `bg-red-50 text-red-700` reads right in both themes.
- A lighter surface reads as raised; shadows barely show. Contrast is re-checked in dark for every pairing (PUI).
- PDFs stay light.

## 7. Depth, borders, shape, motion [U]
| Elevation | Class | For |
| --- | --- | --- |
| On the page | none | Almost everything |
| Raised | `shadow-raised` | A control resting on the page: button, field |
| Overlay | `shadow-overlay` | Floats briefly over content: menu, popover, toast |
| Modal | `shadow-modal` | Takes over the screen: dialog, sheet |

- Pick the level by where the thing sits above the page, not by taste. Light comes from above; each shadow is a soft wide layer plus a tight dark one (RUI, PUI).
- Fewer borders. Separate with space, then with a quieter surface, then with a line. Where two surfaces already differ, the line goes (RUI).
- A border that is too faint gets thicker, not darker (RUI).
- One corner policy: `rounded-sm` (4) small marks and pills · `rounded-md` (6) controls · `rounded-lg` (8) boxes · `rounded-xl` sheets on phones · `rounded-full` avatars and dots. Square and round are never mixed (RUI).
- Motion explains a change and stops: 150–300 ms, only on the part that changes, never on first paint of content. Nothing bounces, pings or drifts. `prefers-reduced-motion` turns it off (DI).
- Icons: one set (lucide), one weight, at the size of the text beside them, labelled with words unless unmistakable; an icon-only control has an `aria-label` and a tooltip. Icons are not scaled up to fill space (RUI, DI, PUI).

## 8. Actions [U]
Buttons are styled by **rank, not meaning** (RUI, PUI).

| Rank | Variant | Looks like | Rule |
| --- | --- | --- | --- |
| Primary | `default` | Solid | The one action the screen or dialog exists for. At most one; none if nothing clearly wins |
| Secondary | `outline` | Same shape, an edge, no fill | Everything else worth a button. Two equal choices are both secondary |
| Tertiary | `link` | Underlined text | Low-stakes: Cancel, Clear filters |
| In a row or toolbar | `ghost` | No edge at rest | Icon-only buttons; repeated per-row actions |
| Confirming a loss | `destructive` | Red fill | Only the confirm button inside `useConfirm()` |

- There is no grey-filled button: it reads as disabled (PUI).
- **Delete is quiet until the confirm step.** At rest it is a secondary or tertiary button named for what it deletes. Confirmation scales with the loss: small → a dialog whose buttons name the action; larger → red confirm and "cannot be recovered"; severe → a box to tick. Undo beats all of these where it is possible (RUI, PUI, UXB).
- Routine actions are never confirmed: confirmations dismissed by reflex stop working when they matter (DI).
- Labels are a verb and a noun in the user's words: "Create project", "Send invoice". Never "OK", "Yes", "Submit". The label makes sense read alone, and names the selection when there is one ("Delete 3 rows") (PUI, DI).
- Placement: under a form, left-aligned, primary first; in a dialog, in the footer, primary last; the same place on every screen of a kind. An action sits next to what it acts on. Phones: stacked, full width, most important on top (PUI, DI).
- A button is disabled only while its own request runs, or with the reason written beside it. A form's submit stays enabled and says what is wrong when pressed (PUI).
- No action is reachable only by a hidden gesture: right-click, double-click, hover, swipe and shortcuts are additions, never the only way (DI).
- Hit area ≥ 44×44 px on touch (the `::after` rule in `globals.css`), ≥ 8 px between targets (PUI, DI).
- Response: under 0.1 s feels instant; over 1 s shows progress, inside the button that was pressed where possible; a long job says what is happening and can be cancelled (DI).

| Size | Desktop | Phone | Use |
| --- | --- | --- | --- |
| `default` | 32 px | 40 px | Forms, dialogs |
| `sm` | 28 px | 36 px | Toolbars |
| `xs` | 24 px | 32 px | In-row actions |
| `icon*` | 24–32 px | 32–40 px | Icon-only |

## 9. Forms [U]
Use `Field` (`src/components/ui/field.tsx`): it lays out label, hint, error and control in the right order with the right ids.

- Every field is a cost. Delete what can be derived or is not needed; ask required things first, optional last or not at all (DI, UXB, PUI).
- One column. Label directly above its field; only short related fields share a row (expiry and code). Radios and checkboxes one per line (PUI, DI).
- The label is always visible, a short noun in the user's words, in `text-foreground`. A placeholder is never the label, and labels do not sit inside the field: a filled-looking field gets skipped (PUI, DI).
- Hint between label and field, `text-caption`, always visible when it matters. Essential help is never behind a link (DI, PUI).
- Field width signals the answer: a short field for a short code, a text area for a paragraph (PUI, DI).
- Mark the rarer kind: "(optional)" on optional fields when most are required. One convention across the app (PUI, DI).
- Choosing the control: two states applied with Save → checkbox; applied at once → switch · up to about 10 options → radios (a select only when space is short) · a long list the person knows → autocomplete · a small number → stepper · a date → the native picker (PUI).
- Defaults: prefill only what most people would keep (today's date, the last choice, the account's values). No default where the person must decide; consent is never pre-ticked (DI, UXB).
- Accept what people type (spaces, dashes, any case) and show back the cleaned value. Strict formats only for codes, with an example (DI).
- **Validation:** when the form is submitted, and then on leaving a corrected field. Never while someone is still typing something that could become valid. Live checks only for password rules, length limits and name availability (PUI, DI).
- **Errors:** on the form, above the field (below is hidden by keyboards and autofill), as an icon and a sentence saying what to do: "Enter a phone number with 10 digits", never "Invalid input". Red plus a second cue; the field is `aria-invalid`. A long form also lists the errors at the top, each linking to its field. Never in a dialog (PUI, DI). The server returns the same sentence the client shows.
- Long forms: group under titled sections; if still long, split into steps of about five related questions, easiest first, with "Step 2 of 4", Back at the top left, a review step, and a closing screen that says what happens next. A form is never split across tabs (PUI, DI).
- After success, say so and say what happens next (DI).
- Save model [P]: dialogs and drawers save with a button; preferences (toggles, segmented controls) save on change.

## 10. Lists, tables and data [P]
| Need | Pattern |
| --- | --- |
| Pick one of many and work on it | Table (desktop) / cards (phone); the record opens in a side drawer so the list keeps its place |
| Compare records | Table with sortable columns; never tabs between the things compared (DI) |
| Find one known item | Search first; the list ordered so the likeliest is at the top |
| A set with several independent attributes | Filters beside the data, applied at once, in the URL (DI) |
| A process with stages | Board [S] |
| Activity on one record | Timeline, newest first |

- Before designing a list, write down: how long it can get, its natural order, what people do to items, what they need to see to choose without opening (DI).
- Every list has an explicit order. Alphabetical only serves lookup; time, amount or status usually serves the work (DI).
- A row shows what is needed to recognise and triage, no more. The primary cell is `font-semibold`; the rest is regular; meta is muted (RUI, DI).
- `table-fixed`: the name column gives way, dates and amounts never wrap. Empty cell "—". Dates "22 Oct 2026". Money right-aligned in the org's currency.
- Related columns that are never sorted separately can share a cell with their own hierarchy (name over email) (RUI).
- Long lists get search and filters; the first screenful is the one that has to be right (DI).
- Selected row: background and a second cue. Bulk actions appear with a selection, labelled with the count (DI).
- Hover-only row tools are also reachable by tap and keyboard, and do not shift the layout when they appear (DI).
- Search + quick filters in the URL; saved views; column chooser; virtualise past about 200 rows; keyset paging.
- Row click or Enter opens the drawer; ↑/↓ move; Esc closes.

## 11. Structure and navigation [U]
- Organise by what users do and how often, in their words. Not by database tables, and not by the org chart (UXB, DI).
- Broad and shallow: more destinations at the top level, fewer levels. Frequent destinations are promoted to the top wherever they sit in the hierarchy; settings and rare things are findable, away from the main action (DI, UXB).
- Every screen answers: what is this, where am I, where can I go, how do I get back. Title, current navigation item, a way out (DI).
- Navigation keeps its place and order on every screen. Controls are never rearranged, and people's things are never auto-sorted or auto-closed (DI: people find things by position).
- The common 80% of a job is done on one screen. When it gets crowded: simplify, then shorten labels, then use progressive disclosure. Tabs and accordions hide things; use them only when the parts are not needed together (DI).
- A focused task (a flow, a modal) drops the global navigation and keeps Back, Next and a way out (DI).
- State worth returning to is in the URL: filters, the open record, the view (DI).
- Conventions hold: logo top-left, account top-right, close top-right of a dialog, global navigation left on desktop and a bottom bar on phones (DI).

| Pattern | Desktop / tablet | Phone | Reference |
| --- | --- | --- | --- |
| [P] App shell | Sidebar 224–240 px + top bar 50 px | Top bar + bottom bar (≤ 4 tabs + More sheet) | `src/components/shell/*` |
| [U] Lists | Dense table, sticky header | Stacked cards | `projects-view.tsx` |
| [U] Record detail | Right drawer; the list keeps its place | Full-width sheet | `ProjectDrawer` |
| [U] Dialogs | Centred, max 480–512 px, one to three exits | Bottom sheet, scrolls, safe-area padding | `src/components/ui/dialog.tsx` |
| [U] Confirm | Shared `useConfirm()`; names the thing; focus on the safe button | Same | `confirm-dialog.tsx` |
| [P] Settings | Grouped side nav ≥ 1024 px; random access, never a forced sequence | Menu page + back links | — |
| [P] Home | What needs attention now, then numbers that link to their rows | Same, one column | — |
| [P] Wizard | Only for a long, rare or branching task where the best route is known; otherwise one form (DI) | Same | — |

- ⌘K command palette and `?` shortcuts sheet [P]. No full reloads; optimistic writes with rollback.
- Role homes: each role lands where its daily work starts.

## 12. States and feedback [U]
| State | Rule |
| --- | --- |
| Loading | A skeleton of the real layout (`PageLoading`); what has loaded shows at once; no full-screen spinner; no layout shift |
| Empty | Says what will appear here and offers the first action (`EmptyState`). Filters and tabs with nothing to filter are hidden. The empty state is the first thing a new user sees: it is designed, not left (RUI) |
| Error (page) | What happened in plain words, "Try again", reassurance nothing was lost |
| Error (action) | A sentence next to where it happened; background failures persist somewhere findable |
| Success | Confirmed, with the next step (DI) |
| Offline | "Needs a connection; nothing saved was lost" |
| Read-only | Edit controls hidden; "You can view this" |

- Every action gets an answer: received, in progress, done (DI).
- Trying something is safe: Back behaves normally, nothing is lost, undo where possible (DI).
- Unfinished work is kept: a half-filled form survives leaving and coming back (DI).

## 13. Charts and KPI tiles [P]
- A chart earns its place by answering a trend or comparison question. Otherwise a number or a table. No gauges, dials, pies, rings, 3D or decoration (DI, UXB).
- Bars and lines. One neutral series colour and one accent; series differ by lightness, not only by hue; status colours only for status (RUI, DI).
- Each graphic is understood with no interaction; exact values on hover or tap; the legend sits beside the chart (DI).
- KPI tile: label (`text-caption`, muted) · value (`text-display`, tabular) · change against the previous period with a sign and an arrow, coloured only for good or bad · links to the rows behind it.
- A dashboard is edited hard: what needs attention first, then the few figures that matter, on one screen (DI).
- Missing or bad data is shown as such, never as zero (UXB).
- Default library: Recharts, only when a chart is needed.

## 14. Copy [U]
- Short plain sentences in the user's words; under 20 words; key information first (PUI).
- One term per thing across the app: pick "Delete" or "Remove", "Sign in" or "Log in", and keep it (PUI, DI).
- Errors say what to do: "Give the project a name." Never "Validation failed". No blame, no "oops", no "please" (PUI).
- Confirmations name the object and the consequence: "Delete Website relaunch? The audit log keeps a record."
- Links name where they go; never "click here" or "learn more" (PUI).
- Digits for numbers; `1,250,000`; no abbreviations a new user would not know; no jargon ("entity", "record id", "sync") (PUI).
- No full stop on a short label; no exclamation marks; emoji only where the product's voice calls for it in copy (PUI).

## 15. Phones [U]
- Designed for what people do on a phone, not shrunk from desktop. Decide per feature whether the phone needs it at all (DI, UXB).
- One column; task content starts at the top, within the first 100 px; nothing scrolls sideways except a wide table inside its own box (DI).
- Bottom bar ≤ 4 tabs + More; dialogs become bottom sheets; lists become cards; detail is a full-width sheet.
- Targets ≥ 44 px with gaps; fields ≥ 16 px text (no iOS zoom); safe areas on bars and sheets.
- Less typing: prefill, choose instead of type, numeric keyboards, the camera and location where they save effort (DI).
- Flows are short and resumable after an interruption (DI).
- Detail: [PWA_STANDARD.md](PWA_STANDARD.md), [../checklists/responsive.md](../checklists/responsive.md).

## 16. Accessibility [U]
- WCAG 2.1 AA in both themes: text ≥ 4.5:1 (large ≥ 3:1), field and control edges ≥ 3:1, meaningful icons ≥ 3:1 (PUI).
- Meaning never by colour alone (§6). Interactive things look interactive; decoration never does (DI, PUI).
- Keyboard: every action reachable, logical tab order, Enter submits, Esc closes, focus returns to the trigger; focus ring visible.
- Every icon button has `aria-label`; dialogs and sheets have titles; errors use `role="alert"`; `aria-current="page"` in navigation.
- Text can be enlarged without breaking the layout.

## 17. Checked by script
`npm run design:check` (`scripts/design-check.ts`). Errors fail `npm test`.

| Rule id | Fails on | § |
| --- | --- | --- |
| `type-scale` | A font size outside the seven steps: `text-[13px]`, `text-sm`, inline `font-size` | 5 |
| `font-weight` | Any weight but `font-normal` and `font-semibold` | 5 |
| `font-family` | `font-serif`, an arbitrary font | 5 |
| `spacing-scale` | A spacing step off the scale (`p-5`, `gap-[7px]`) | 4 |
| `no-gradient` | Gradient classes or CSS gradients | 6 |
| `elevation-scale` | Any shadow but the three levels; hand-written shadows; glow blurs | 7 |
| `radius-scale` | `rounded-2xl` and larger, arbitrary radii | 7 |
| `color-tokens` | Hex, `rgb()`, `oklch()` outside `globals.css`; one-off colour classes | 6 |
| `palette` | Tailwind colours outside the neutral and status scales | 6 |
| `faint-text` | Text faded with opacity; greys lighter than muted | 6 |
| `uppercase` | `uppercase`, widened letter spacing | 5 |
| `motion` | Bounce, ping, durations over 300 ms | 7 |
| `centered-text`, `emoji` | Warnings: reviewed by eye | 5, 7 |

An exception is one place and one reason: `// design-ok: <why>` on the line or the line above (`// design-ok-file: <why>` in a file's first lines). Exceptions are counted in the report and read in review. A rule that is wrong for the product is changed in `globals.css` and here, with an entry in `factory/DECISIONS.md`, not worked around.

## 18. Reviewed by eye
Everything else in this document. The procedure, the questions and the verdict format are in [../checklists/design-review.md](../checklists/design-review.md). Every UI lane reviews its own screens before opening its PR; an agent that did not build them reviews them again before release.

Related: [PRODUCT_DISCOVERY_STANDARD.md](PRODUCT_DISCOVERY_STANDARD.md) · [PWA_STANDARD.md](PWA_STANDARD.md) · [../checklists/frontend.md](../checklists/frontend.md) · [../workflows/ui-redesign.md](../workflows/ui-redesign.md)
