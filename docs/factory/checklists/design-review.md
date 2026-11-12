# Design review checklist

For every screen, before its PR is opened (by the lane that built it) and again before release (by an agent that did not build it).
Standard: [../docs/UI_UX_STANDARD.md](../docs/UI_UX_STANDARD.md). Mechanical rules are already enforced by `npm run design:check`; this list is what only looking can judge.

## How to review
1. `npm run design:shots` (or `-- --only /design/screens/<screen>`). It photographs every gallery page at 375 and 1280, light and dark, into `factory/screens/`.
2. **Open every image and look at it.** Reading the code is not a review. A screen with no gallery page cannot be reviewed: add one first (`src/lib/design-gallery.ts`).
3. Answer the questions below per screen. A "no" is a finding: fix it (own screen) or report it (someone else's).
4. Write the verdict block in the PR body and in `factory/HANDOFFS.md`.

## 1. First glance (5 seconds, image viewed small or blurred)
- [ ] It is obvious what this screen is for
- [ ] One thing stands out, and it is the right thing: the content or the action the screen exists for
- [ ] At most one solid button; nothing else competes with it
- [ ] The screen reads as a few groups, not as one grey wall and not as a grid of boxes

## 2. Hierarchy
- [ ] Three levels can be told apart: primary, secondary, tertiary. Secondary text is muted, not small-and-bold
- [ ] Not everything is bold; most text is regular weight
- [ ] Titles inside the app are small; no hero heading on a work screen
- [ ] No stack of `Label: value` pairs where the values would explain themselves
- [ ] Icons are quieter than the text beside them, and every icon has a word or a tooltip
- [ ] The most valuable information and action come first on the screen

## 3. Space and grouping
- [ ] Things that belong together are closer to each other than to anything else (label to its field; a title to its section)
- [ ] No box inside a box; boxes only around distinct objects or main regions
- [ ] Left edges line up; nothing is centred except a short heading or an empty state
- [ ] Nothing touches an edge, a border or its neighbour
- [ ] Content has the width it needs: forms are narrow, reading text is at most about 70 characters a line, nothing is stretched to fill

## 4. Colour and depth
- [ ] The screen still reads with colour removed (grey screenshot)
- [ ] Every coloured thing means something: an action, a status, an error, a selection
- [ ] No status is shown by colour alone
- [ ] Shadows only on controls, menus and dialogs; everything else is flat
- [ ] Dark mode: same hierarchy, nothing unreadable, no surface that vanishes

## 5. Actions and forms
- [ ] Button labels are a verb and a noun and make sense read alone
- [ ] Delete and other losses are quiet until the confirm step, and the confirm names the thing
- [ ] Every field has a visible label above it; no placeholder doing a label's job
- [ ] The form asks only what is needed; optional fields are marked; one column
- [ ] Errors appear above their field as a sentence saying what to do, with an icon
- [ ] Actions sit next to what they act on, in the same place as on similar screens

## 6. States and content
- [ ] Empty state: says what will appear and offers the first action
- [ ] Loading and error states exist and were looked at
- [ ] The longest value, the shortest value, a missing value and a large number all hold: nothing clipped, wrapped badly or overlapping (the sample data must include them)
- [ ] One item and many items both look right
- [ ] Every chart or figure answers a question someone has; nothing decorative

## 7. Words
- [ ] Sentence case; no capital-letter labels
- [ ] Plain words in the user's language; one term per thing; no jargon
- [ ] Nothing is said twice; nothing is there to fill space

## 8. Phone (375)
- [ ] One column; task content starts at the top; no sideways scroll
- [ ] Targets are at least 44 px with gaps; the main action is within reach
- [ ] The same task can be finished as on desktop

## Verdict (in the PR body and `factory/HANDOFFS.md`)
```
DESIGN REVIEW: PASS | PASS WITH NOTES | FAIL
REVIEWER: <agent> (built it: yes | no)
SCREENS LOOKED AT: <gallery paths> at 375 and 1280, light and dark
DESIGN-CHECK: <errors> errors, <warnings> warnings, <n> documented exceptions (each read: yes | no)
FINDINGS:
| Screen | Width / theme | § | What is wrong | Fix |
NOT REVIEWED: <screens without a gallery page, and why>
```
`FAIL`: any tell from the standard's §1 list, a missing state, an unreadable or broken screen, or a screen that was not looked at.
