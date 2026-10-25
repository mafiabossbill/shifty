export type SettingsIcon = "sessions" | "pay" | "places" | "appearance" | "privacy" | "data" | "account" | "device";

export interface SettingsLink {
  href: string;
  label: string;
  icon: SettingsIcon;
  /** Paths that also mark this link active (the desktop /settings index shows Your sessions). */
  also?: string[];
}

export const SETTINGS_GROUPS: readonly { title: string; links: readonly SettingsLink[] }[] = [
  {
    title: "Tracking",
    links: [
      { href: "/settings/sessions", label: "Your sessions", icon: "sessions", also: ["/settings"] },
      { href: "/settings/pay", label: "Pay", icon: "pay" },
      { href: "/settings/places", label: "Places", icon: "places" },
    ],
  },
  {
    title: "You",
    links: [
      { href: "/settings/appearance", label: "Appearance", icon: "appearance" },
      { href: "/settings/privacy", label: "Privacy", icon: "privacy" },
      { href: "/settings/data", label: "Your data", icon: "data" },
      { href: "/settings/account", label: "Account", icon: "account" },
    ],
  },
  { title: "Device", links: [{ href: "/settings/device", label: "This device", icon: "device" }] },
];

export function isSettingsActive(pathname: string | null, link: SettingsLink): boolean {
  if (!pathname) return false;
  return pathname === link.href || pathname.startsWith(`${link.href}/`) || (link.also ?? []).includes(pathname);
}
