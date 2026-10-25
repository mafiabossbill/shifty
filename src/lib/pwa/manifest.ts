import type { MetadataRoute } from "next";

import { APP_CONFIG } from "@/lib/app-config";
import { THEME_COLORS } from "@/lib/theme";

const SHORTCUT_ICON = { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" };

/**
 * The web app manifest. Every URL is relative (start_url, scope, icons), never a
 * hostname, so the same build works on preview URLs and on the final domain.
 */
export function buildManifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_CONFIG.name,
    short_name: APP_CONFIG.shortName,
    description: APP_CONFIG.description,
    lang: APP_CONFIG.locale,
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone"],
    // Opening from the icon or a shortcut reuses the open window instead of stacking a second one.
    launch_handler: { client_mode: "navigate-existing" },
    orientation: "any",
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the icon (Android, desktop). The home screen handles `?action=clock-in`.
    shortcuts: [
      { name: "Clock in", short_name: "Clock in", url: "/?action=clock-in", icons: [SHORTCUT_ICON] },
      { name: "Sessions", short_name: "Sessions", url: "/sessions", icons: [SHORTCUT_ICON] },
      { name: "Insights", short_name: "Insights", url: "/insights", icons: [SHORTCUT_ICON] },
    ],
  };
}
