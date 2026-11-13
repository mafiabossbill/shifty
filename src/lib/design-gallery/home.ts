import { awaiting, type GalleryArea } from "./types";

/** Home (lane R1). Screen plans: factory/PRODUCT_BLUEPRINT.md § Screens. */
export const HOME_SCREENS: GalleryArea = {
  "/": awaiting("R1"),
  "/dashboard": { exempt: "A redirect to Home, kept for old links and installed shortcuts. It draws nothing." },
};
