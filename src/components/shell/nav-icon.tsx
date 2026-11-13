import { ChartColumnBigIcon, HistoryIcon, HouseIcon, Settings2Icon, SmileIcon, type LucideProps } from "lucide-react";

import type { NavIconName } from "@/lib/nav";

const ICONS = {
  home: HouseIcon,
  sessions: HistoryIcon,
  insights: ChartColumnBigIcon,
  companion: SmileIcon,
  settings: Settings2Icon,
} as const;

/** Navigation icons: one set (lucide), always next to their word. */
export function NavIcon({ icon, ...props }: { icon: NavIconName } & LucideProps) {
  const Icon = ICONS[icon];
  return <Icon aria-hidden {...props} />;
}
