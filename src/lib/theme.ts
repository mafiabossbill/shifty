/*
 * Appearance: theme (Light, Dark, System), accent (lilac, indigo, teal, peach) and motion
 * (System, Reduce). Stored in localStorage so the inline script below applies them before
 * first paint (no flash). The settings lane also saves them on user_settings for other devices
 * and calls setTheme/setAccent/setMotion from useTheme() to apply them here.
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

/** Browser chrome / status bar / splash color per theme = the app background (globals.css). */
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: "#fbf8f1", dark: "#0c0a18" };

/** Swatch per accent and theme for pickers (= --brand in globals.css, which holds the full token set). */
export const ACCENT_SWATCHES: Record<Accent, { label: string; light: string; dark: string }> = {
  lilac: { label: "Lilac", light: "#5b4ff5", dark: "#8b7bff" },
  indigo: { label: "Indigo", light: "#4552e0", dark: "#7d8bff" },
  teal: { label: "Teal", light: "#0f766b", dark: "#3cc8b4" },
  peach: { label: "Peach", light: "#b8491f", dark: "#ff9f80" },
};

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
