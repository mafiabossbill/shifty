/*
 * Appearance: Light, Dark or System. Stored in localStorage so the inline script
 * below sets the right theme before first paint (no flash). Products that need it
 * across devices also save it on the profile (e.g. profiles.theme).
 */
export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = Exclude<Theme, "system">;

export const THEME_STORAGE_KEY = "app:theme";

/** Browser chrome / status bar / splash color per theme = the app background (globals.css). */
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: "#ffffff", dark: "#0c0e15" };

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Runs in <head> before anything renders, so it must be self-contained. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});}catch(e){}if(t!=="light"&&t!=="dark")t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var d=document.documentElement;d.classList.toggle("dark",t==="dark");d.style.colorScheme=t;var c=t==="dark"?${JSON.stringify(THEME_COLORS.dark)}:${JSON.stringify(THEME_COLORS.light)};document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",c);m.removeAttribute("media");});})();`;
