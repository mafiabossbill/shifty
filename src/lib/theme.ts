/*
 * Appearance: theme (Light, Dark, System), accent (lilac, indigo, teal, peach) and motion
 * (System, Reduce). Stored in localStorage so the inline script below applies them before first
 * paint (no flash). With nothing stored the theme follows the device (System) and the accent is
 * lilac. The settings screen also saves them with the person's settings for other devices and
 * calls setTheme/setAccent/setMotion from useTheme() to apply them here.
 *
 * The accent is the one action colour (`--primary` in globals.css): <html data-accent="…">
 * picks it. There is one at a time; its shades per theme live in globals.css, nowhere else.
 */
export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = Exclude<Theme, "system">;

export const ACCENTS = ["lilac", "indigo", "teal", "peach"] as const;
export type Accent = (typeof ACCENTS)[number];
export const DEFAULT_ACCENT: Accent = "lilac";

/** "system" follows prefers-reduced-motion; "reduce" turns motion down whatever the device says. */
export const MOTIONS = ["system", "reduce"] as const;
export type Motion = (typeof MOTIONS)[number];

export const THEME_STORAGE_KEY = "app:theme";
export const ACCENT_STORAGE_KEY = "shifty:accent";
export const MOTION_STORAGE_KEY = "shifty:motion";

/**
 * Browser chrome / status bar / splash colour per theme = `--background` in globals.css.
 * A literal because the browser reads it from a <meta> tag and the manifest, before any CSS.
 */
// design-ok: mirrors --background; meta theme-color and the manifest cannot read a CSS token
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: "#fbf8f1", dark: "#0c0a18" };

export const ACCENT_LABELS: Record<Accent, string> = { lilac: "Lilac", indigo: "Indigo", teal: "Teal", peach: "Peach" };

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function isAccent(value: unknown): value is Accent {
  return typeof value === "string" && (ACCENTS as readonly string[]).includes(value);
}

export function isMotion(value: unknown): value is Motion {
  return typeof value === "string" && (MOTIONS as readonly string[]).includes(value);
}

/** Runs in <head> before anything renders, so it must be self-contained. */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement,t,a,m;try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});a=localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)});m=localStorage.getItem(${JSON.stringify(MOTION_STORAGE_KEY)});}catch(e){}if(t!=="light"&&t!=="dark")t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.classList.toggle("dark",t==="dark");d.style.colorScheme=t;if(${JSON.stringify(ACCENTS)}.indexOf(a)<0)a=${JSON.stringify(DEFAULT_ACCENT)};d.setAttribute("data-accent",a);if(m==="reduce")d.setAttribute("data-motion","reduce");var c=t==="dark"?${JSON.stringify(THEME_COLORS.dark)}:${JSON.stringify(THEME_COLORS.light)};document.querySelectorAll('meta[name="theme-color"]').forEach(function(x){x.setAttribute("content",c);x.removeAttribute("media");});})();`;
