import { ChartColumnBigIcon, HistoryIcon, HouseIcon, Settings2Icon, SparklesIcon, type LucideProps } from "lucide-react";

import type { NavIconName } from "@/lib/nav";

const ICONS = {
  home: HouseIcon,
  sessions: HistoryIcon,
  insights: ChartColumnBigIcon,
  companion: SparklesIcon,
  settings: Settings2Icon,
} as const;

export function NavIcon({ icon, ...props }: { icon: NavIconName } & LucideProps) {
  const Icon = ICONS[icon];
  return <Icon aria-hidden {...props} />;
}
