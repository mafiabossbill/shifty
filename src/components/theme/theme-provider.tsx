"use client";

import * as React from "react";

import {
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  MOTION_STORAGE_KEY,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  isAccent,
  isMotion,
  isTheme,
  type Accent,
  type Motion,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme";

/*
 * Appearance for this tab. The inline script in the root layout already set
 * <html class="dark" data-accent="…" data-motion="…"> before first paint; this keeps
 * them in sync when a choice changes here, in another tab, or (for System) on the device.
 */

const APPEARANCE_EVENT = "app:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
const KEYS = [THEME_STORAGE_KEY, ACCENT_STORAGE_KEY, MOTION_STORAGE_KEY];
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) return stored;
  } catch {
    // Storage blocked: fall back to this tab's memory.
  }
  return memory.get(key) ?? null;
}

function store(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Kept in memory for this tab.
  }
  window.dispatchEvent(new Event(APPEARANCE_EVENT));
}

function readTheme(): Theme {
  const value = read(THEME_STORAGE_KEY);
  return isTheme(value) ? value : "system";
}
function readAccent(): Accent {
  const value = read(ACCENT_STORAGE_KEY);
  return isAccent(value) ? value : DEFAULT_ACCENT;
}
function readMotion(): Motion {
  const value = read(MOTION_STORAGE_KEY);
  return isMotion(value) ? value : "system";
}
function resolveTheme(): ResolvedTheme {
  const theme = readTheme();
  if (theme !== "system") return theme;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}
function resolveReducedMotion(): boolean {
  return readMotion() === "reduce" || window.matchMedia(REDUCE_QUERY).matches;
}

function subscribe(onChange: () => void) {
  const dark = window.matchMedia(DARK_QUERY);
  const reduce = window.matchMedia(REDUCE_QUERY);
  const onStorage = (event: StorageEvent) => event.key !== null && KEYS.includes(event.key) && onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(APPEARANCE_EVENT, onChange);
  dark.addEventListener("change", onChange);
  reduce.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(APPEARANCE_EVENT, onChange);
    dark.removeEventListener("change", onChange);
    reduce.removeEventListener("change", onChange);
  };
}

/** <html> class, color-scheme and the browser/status-bar color. */
function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  // Swapping themes shouldn't animate every color transition on the page.
  root.classList.add("theme-switching");
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = THEME_COLORS[resolved];
    meta.removeAttribute("media");
  }
  requestAnimationFrame(() => root.classList.remove("theme-switching"));
}

export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
  /** The stored choice ("system" follows the device). */
  motion: Motion;
  setMotion: (motion: Motion) => void;
  /** True when motion should be minimal (device setting or the in-app choice). Use for JS-driven animation. */
  reducedMotion: boolean;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => undefined,
  accent: DEFAULT_ACCENT,
  setAccent: () => undefined,
  motion: "system",
  setMotion: () => undefined,
  reducedMotion: false,
});

const setTheme = (theme: Theme) => store(THEME_STORAGE_KEY, theme);
const setAccent = (accent: Accent) => store(ACCENT_STORAGE_KEY, accent);
const setMotion = (motion: Motion) => store(MOTION_STORAGE_KEY, motion);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
  const resolvedTheme = React.useSyncExternalStore(subscribe, resolveTheme, () => "light" as ResolvedTheme);
  const accent = React.useSyncExternalStore(subscribe, readAccent, () => DEFAULT_ACCENT);
  const motion = React.useSyncExternalStore(subscribe, readMotion, () => "system" as Motion);
  const reducedMotion = React.useSyncExternalStore(subscribe, resolveReducedMotion, () => false);

  React.useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-accent", accent);
  }, [accent]);

  React.useEffect(() => {
    const root = document.documentElement;
    if (motion === "reduce") root.setAttribute("data-motion", "reduce");
    else root.removeAttribute("data-motion");
  }, [motion]);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme, accent, setAccent, motion, setMotion, reducedMotion }),
    [theme, resolvedTheme, accent, motion, reducedMotion],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
