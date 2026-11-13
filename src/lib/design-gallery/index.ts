/**
 * The design gallery's index: every signed-in screen, and where it can be seen with sample data.
 *
 * A screen that cannot be looked at cannot be reviewed. Each route under src/app/(app) is either
 * rendered in the gallery (src/app/design/screens/<area>/…, in every state it can be in) or exempt
 * with a reason. tests/design.test.ts fails when a screen is missing here; `npm run design:shots`
 * photographs every entry at phone and desktop width, light and dark.
 *
 * One file per area, so lanes never edit the same file: a lane changes only its own
 * (home.ts, sessions.ts, insights.ts, companion.ts, settings.ts). How to add a page:
 * factory/handoffs/redesign-r0.md § Gallery.
 */
import { COMPANION_SCREENS } from "./companion";
import { HOME_SCREENS } from "./home";
import { INSIGHTS_SCREENS } from "./insights";
import { SESSIONS_SCREENS } from "./sessions";
import { SETTINGS_SCREENS } from "./settings";
import { PUBLIC_PAGES, SYSTEM_PAGES } from "./shared";
import type { GalleryEntry } from "./types";

export type { GalleryArea, GalleryEntry } from "./types";
export { PUBLIC_PAGES, SYSTEM_PAGES };

/** The areas in navigation order, for the list on the system page. */
export const AREAS = [
  { name: "Home", screens: HOME_SCREENS },
  { name: "Sessions", screens: SESSIONS_SCREENS },
  { name: "Insights", screens: INSIGHTS_SCREENS },
  { name: "Companion", screens: COMPANION_SCREENS },
  { name: "Settings", screens: SETTINGS_SCREENS },
] as const;

export const SCREENS: Record<string, GalleryEntry> = Object.assign({}, ...AREAS.map((area) => area.screens));

/** Each state is its own page: the default at the gallery path, any other in a folder named after it. */
export function stateRoute(gallery: string, state: string): string {
  return state === "default" ? gallery : `${gallery}/${state}`;
}

/** Every gallery page: the system and shared pages, then each screen in each state. */
export function galleryRoutes(): string[] {
  const routes: string[] = [...SYSTEM_PAGES];
  for (const entry of Object.values(SCREENS)) {
    if ("gallery" in entry) for (const state of entry.states) routes.push(stateRoute(entry.gallery, state));
  }
  return routes;
}

/** Every address `npm run design:shots` photographs: the gallery, then the public pages. */
export function photographedRoutes(): string[] {
  return [...galleryRoutes(), ...PUBLIC_PAGES];
}
