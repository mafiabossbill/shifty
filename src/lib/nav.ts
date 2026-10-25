export type NavIconName = "home" | "sessions" | "insights" | "companion" | "settings";

export interface NavItem {
  href: string;
  label: string;
  /** lucide icon name, resolved in components/shell/nav-icon.tsx (keeps this file server-safe). */
  icon: NavIconName;
}

/**
 * The five places, in this order everywhere: phone bottom bar and desktop sidebar.
 * Single-user product: no capability filtering, no team or workspace items.
 */
export const MAIN_NAV: readonly NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/sessions", label: "Sessions", icon: "sessions" },
  { href: "/insights", label: "Insights", icon: "insights" },
  { href: "/companion", label: "Companion", icon: "companion" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

/** Pages outside the nav that still get a title in the top bar. */
const OTHER_TITLES: Record<string, string> = { "/design": "Design" };

export function isActivePath(pathname: string | null, href: string): boolean {
  if (pathname === null) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Page title for the top bar, by path prefix. */
export function titleFor(pathname: string | null): string {
  if (pathname === null) return "";
  const item = MAIN_NAV.find((n) => isActivePath(pathname, n.href));
  if (item) return item.label;
  const other = Object.keys(OTHER_TITLES).find((href) => isActivePath(pathname, href));
  return other ? OTHER_TITLES[other] : "";
}
