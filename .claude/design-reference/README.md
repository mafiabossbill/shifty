# Design reference (from the factory starter)

The design system as it exists in the factory's starter app (bill-app-factory, `templates/nextjs-supabase`), copied here for
the redesign (`factory/REDESIGN.md`). Nothing in this folder is compiled, linted or tested. **Port it, don't paste it:** SHIFTY's
own files differ (device mode, its own primitives, its own store). The rules these files implement are in
`docs/factory/docs/UI_UX_STANDARD.md`.

| File | What to take from it |
| --- | --- |
| `src/app/globals.css` | The token blocks: the seven-step type scale with `--text-*: initial`, the three elevations with `--shadow-*: initial`, `--control` (field edge at 3:1), the phone step-up of the type scale |
| `src/lib/utils.ts` | `cn()` built with `extendTailwindMerge` so the merge knows the type-scale and elevation names. Without it `text-body text-muted-foreground` loses its size |
| `scripts/design-check.ts` | The check. Copy as is to `scripts/`; adjust only the palette list if SHIFTY's status scales differ |
| `scripts/design-shots.ts` | Photographs every gallery page at 375 and 1280, light and dark, into `factory/screens/` |
| `tests/design.test.ts` | Runs the check inside `npm test`; requires a gallery entry for every signed-in route |
| `src/lib/design-gallery.ts` | The registry of screens → gallery pages (or a written exemption) |
| `src/app/design/**`, `src/components/design/**` | The gallery: a development-only layout, the system page, screens rendered with sample data inside the shell |
| `src/lib/public-paths.ts`, `tests/public-paths.test.ts` | The gallery path is public in development only |
| `src/components/ui/button.tsx` | Buttons by rank: solid, outline, underlined link, ghost; red only for the confirm step; no grey-filled variant |
| `src/components/ui/field.tsx`, `label.tsx`, `input.tsx` | Label above, hint, error above the control as an icon and a sentence; field edge `border-control` |
| `src/components/ui/status-pill.tsx`, `empty-state.tsx` | Dark ink on a light tint, regular weight; empty state says what will appear and offers the first action |
| `src/components/projects/projects-view.tsx`, `src/components/team/team-settings.tsx` | A list screen and a settings screen built from the system: table on desktop (`table-fixed`, dates never wrap), cards on phones, rows that stack on phones, quiet delete |
| `CLAUDE.md` | The UI rules to copy into SHIFTY's `CLAUDE.md` |
| `package.json`, `.gitignore` | `design:check`, `design:shots` scripts; `/factory/screens/` ignored |
