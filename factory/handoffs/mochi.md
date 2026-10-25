### 2026-10-25 frontend-engineer — Mochi companion mascot (art, habitat, catalog, mood)
AGENT: frontend-engineer (mochi lane)
TASK: mochi — original companion mascot, habitat, unlock catalog, mood rules, review gallery
FILES CHANGED: `src/components/mochi/{parts.ts,catalog.ts,mood.ts,mochi.tsx,habitat.tsx,gallery.tsx}`, `tests/mochi-catalog.test.ts`, this file
WHAT WAS IMPLEMENTED:
- `<Mochi />`: original soft five-point star-blob, pure inline SVG (no images). Seven moods with their own pose, eyes, mouth and extras: happy, focused, sleepy (z's), resting (steam mug), celebrating (sparkles, warm-orange confetti, hop), proud, curious (?). 8 palettes, 8 hats, 5 accessories. Reads clearly at 32/48px and at 140–220px.
- Idle motion in CSS only: breathing squash, a blink every ~5.6s, twinkles, floating z's, steam, celebration hop. All of it stops with `animate={false}` and under `prefers-reduced-motion: reduce` (checked in a browser: 40 animated elements → 0 in both cases).
- `<Habitat />`: cosy 4:3 SVG scene behind its children. 6 backgrounds (dusk, dawn, starfield, meadow, rainy-window, library), 12 decor items in fixed slots, `theme` dark/light tuned to #0c0a18 / #fbf8f1, `timeOfDay` day/evening/night (lights glow from evening on; night dims the room a little).
- `catalog.ts`: 39 unlockable items as data. Level road 2–30 (something new at every level up to 24, crown at 30) plus one item for each of the 10 achievement codes. Exports `unlockedKeys`, `isUnlocked`, `nextUnlocks`.
- `mood.ts`: pure `moodFor()` that picks the mood and a short line. It never praises long hours: past the goal, or at 75% of it, Mochi gets sleepy and suggests a break or rest. `gallery.tsx` (client) shows everything for review, with dark/light, motion and time-of-day toggles.
IMPORTANT DECISIONS:
- "none" hat/accessory is not a catalog item: it is always available and `isUnlocked("none")` is true. Catalog keys are plain ids, unique across all kinds (`lilac`, `beanie`, `dusk`, …).
- Part lists live in `parts.ts`. The drawing maps are typed `Record<Key, …>`, so tsc fails if a part has no drawing, and the test fails if the catalog and the drawings drift apart.
- Achievement items: first_clock_in→party-hat, night_owl→night-cap, consistency_week→flower-crown, break_champion→coffee-mug, data_keeper→treasure-chest, first_100h→trophy-shelf, comeback→star-wand, early_bird→dawn, weekly_reviewer→glasses, rest_respecter→cushion.
- Wall decor (bookshelf, window-moon, clock, trophy-shelf) is not drawn on the outdoor backgrounds (starfield, meadow). This rule is in `WALL_DECOR` / `OUTDOOR_BACKGROUNDS`.
- Inline `<style>` inside each SVG with `mochi-*` / `habitat-*` class names, instead of a CSS module: it works in server and client components and needs no bundler CSS. `useId` gives each instance unique gradient and clip ids. `Mochi` and `Habitat` have no client hooks, so they can render in server components. Only `gallery.tsx` is `"use client"`.
- Habitat layout uses inline styles, not Tailwind, so the scene looks the same wherever it is mounted. Use `className`/`style` to size and round it.
DEPENDENCIES: none at runtime. The rewards engine (another lane) must supply `level` and earned achievement codes; the UI must supply status/localHour/netMs/goalMs for `moodFor`.
KNOWN RISKS:
- Real devices not checked: no iPhone or Android run yet. Verified only in headless Chromium at 390 (DPR 2) and 1280, both themes: no console or hydration errors, and `scrollWidth` equals the viewport width.
- The SVG `<style>` block repeats once per instance. That is fine for normal pages; the gallery has about 60 instances.
- Habitat is 4:3 with `preserveAspectRatio="xMidYMax slice"`. Very wide containers crop the ceiling first (the string lights).
- With the resting mood, Mochi's own steam mug and the habitat's coffee-mug decor can both show. They sit in separate places.
- Not linked anywhere. The design/companion lane must mount the components and decide where the gallery lives (if anywhere).
TESTS RUN: `npm run lint`; `npm run typecheck`; `npx vitest run`; browser check: `next dev --webpack -p 3102` with a temporary page (deleted), Playwright screenshots at 390 and 1280 in dark and light, a reduced-motion check, a console-error check
TEST RESULTS: lint PASS; typecheck PASS; vitest 18 files / 107 tests PASS (13 of them in `tests/mochi-catalog.test.ts`); browser: 0 console errors, no sideways scroll at 390/1280, animations off under reduce and `animate={false}`
NEXT AGENT ACTION: design/companion lane (frontend-engineer) — mount `<Habitat><Mochi /></Habitat>` on the companion screen (~150–180px Mochi in a full-width habitat) and `<Mochi size={32|48} />` in the nav/ribbon. Drive `mood` from `moodFor()`, and drive the equip pickers from `CATALOG` + `unlockedKeys(level, codes)` + `nextUnlocks(level, 3)`.
COMMIT: see `git log -1` on lane/mochi (not pushed)
