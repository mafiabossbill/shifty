import type { Capability } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  /** lucide icon name, resolved in components/shell (keeps this file server-safe). */
  icon: "home" | "folder" | "settings";
  /** Hidden unless the viewer has this capability. */
  requires?: Capability;
}

/** Plain arrays, so each feature adds its own line. Phones show the first four in the bottom bar. */
export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
];

export const SETTINGS_NAV: NavItem = { href: "/settings", label: "Settings", icon: "settings" };

/** Page title for the top bar, by path prefix. */
export function titleFor(pathname: string): string {
  const item = [...MAIN_NAV, SETTINGS_NAV].find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
  return item?.label ?? "";
}

export function visibleNav(capabilities: readonly Capability[]): NavItem[] {
  return MAIN_NAV.filter((item) => !item.requires || capabilities.includes(item.requires));
}
