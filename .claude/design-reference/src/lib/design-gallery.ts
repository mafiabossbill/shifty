/**
 * The design gallery's index: every signed-in screen, and where it can be seen with sample data.
 *
 * A screen that cannot be looked at cannot be reviewed. Each route under src/app/(app) is either
 * rendered in the gallery (src/app/design/screens/…, in every state it can be in) or exempt with
 * a reason. tests/design.test.ts fails when a screen is missing here; `npm run design:shots`
 * photographs every entry at phone and desktop width, light and dark.
 */
export type GalleryEntry = { gallery: string; states: readonly string[] } | { exempt: string };

export const SCREENS: Record<string, GalleryEntry> = {
  "/dashboard": { exempt: "Starter placeholder (a list of links). The product's real home replaces it and gets a gallery entry." },
  "/projects": { gallery: "/design/screens/projects", states: ["default", "empty"] }, // @example
  "/settings": { exempt: "Starter placeholder (three links and the theme switch, all shown in /design)." },
  "/settings/account": { exempt: "Two actions on the signed-in person's own data; nothing to vary." },
  "/settings/team": { gallery: "/design/screens/team", states: ["default", "empty"] },
};

/** Each state is its own page: the default at the gallery path, any other in a folder named after it. */
export function stateRoute(gallery: string, state: string): string {
  return state === "default" ? gallery : `${gallery}/${state}`;
}

/** Gallery pages that show the system itself rather than one screen. */
export const SYSTEM_PAGES = ["/design"] as const;

/** Every address `npm run design:shots` photographs: the system page, then each screen in each state. */
export function galleryRoutes(): string[] {
  const routes: string[] = [...SYSTEM_PAGES];
  for (const entry of Object.values(SCREENS)) {
    if ("gallery" in entry) for (const state of entry.states) routes.push(stateRoute(entry.gallery, state));
  }
  return routes;
}
