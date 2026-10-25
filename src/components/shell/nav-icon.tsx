import { FolderIcon, HomeIcon, SettingsIcon } from "lucide-react";

import type { NavItem } from "@/lib/nav";

const ICONS = { home: HomeIcon, folder: FolderIcon, settings: SettingsIcon } as const;

export function NavIcon({ icon, className, strokeWidth = 1.75 }: { icon: NavItem["icon"]; className?: string; strokeWidth?: number }) {
  const Icon = ICONS[icon];
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />;
}
