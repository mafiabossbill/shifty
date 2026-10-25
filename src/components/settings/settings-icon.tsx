import { BanknoteIcon, ClockIcon, DatabaseIcon, MapPinIcon, PaletteIcon, ShieldIcon, SmartphoneIcon, UserRoundIcon } from "lucide-react";

import type { SettingsIcon as Name } from "./nav";

const ICONS: Record<Name, React.ComponentType<{ className?: string }>> = {
  sessions: ClockIcon,
  pay: BanknoteIcon,
  places: MapPinIcon,
  appearance: PaletteIcon,
  privacy: ShieldIcon,
  data: DatabaseIcon,
  account: UserRoundIcon,
  device: SmartphoneIcon,
};

export function SettingsIcon({ name, className }: { name: Name; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden />;
}
