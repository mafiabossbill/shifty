"use client";

import * as React from "react";

import { THEME_COLORS, THEME_STORAGE_KEY, isTheme, type ResolvedTheme, type Theme } from "@/lib/theme";

/*
 * The active theme for this tab. The inline script in the root layout already set
 * <html class="dark"> before first paint; this keeps it in sync when the choice
 * changes here, in another tab, or (for System) on the device.
 */

const THEME_EVENT = "app:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
let memoryTheme: Theme | null = null;

function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // Storage blocked: fall back to this tab's memory.
  }
  return memoryTheme ?? "system";
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  const onStorage = (event: StorageEvent) => event.key === THEME_STORAGE_KEY && onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_EVENT, onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
}

function storeTheme(theme: Theme) {
  memoryTheme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Kept in memory for this tab.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
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

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
  const resolvedTheme = React.useSyncExternalStore(
    subscribe,
    () => (readTheme() === "system" ? systemTheme() : (readTheme() as ResolvedTheme)),
    () => "light" as ResolvedTheme,
  );

  React.useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const value = React.useMemo(() => ({ theme, resolvedTheme, setTheme: storeTheme }), [theme, resolvedTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
