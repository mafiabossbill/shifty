"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { useTheme } from "@/components/theme/theme-provider";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SwitchRow } from "@/components/ui/switch";
import { ACCENTS, ACCENT_LABELS, type Accent, type Theme } from "@/lib/theme";

/*
 * Appearance controls. Each applies at once (no Save button for a preference). The settings screen
 * mounts these and also saves the choice with the person's settings for other devices.
 */

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: <SunIcon /> },
  { value: "dark", label: "Dark", icon: <MoonIcon /> },
  { value: "system", label: "System", icon: <MonitorIcon /> },
] as const satisfies readonly { value: Theme; label: string; icon: React.ReactNode }[];

export function ThemeSetting({ onChange }: { onChange?: (theme: Theme) => void }) {
  const { theme, setTheme } = useTheme();
  return (
    <SegmentedControl
      ariaLabel="Theme"
      value={theme}
      options={THEME_OPTIONS}
      onValueChange={(next) => {
        setTheme(next);
        onChange?.(next);
      }}
    />
  );
}

const ACCENT_OPTIONS = ACCENTS.map((value) => ({ value, label: ACCENT_LABELS[value] }));

/**
 * Retired by R-D5: the interface has one action colour, so this choice no longer changes anything
 * on screen. It still stores the value, so the Appearance screen keeps working until its lane (R5)
 * takes the row out. Do not add it to a new screen.
 */
export function AccentSetting({ onChange }: { onChange?: (accent: Accent) => void }) {
  const { accent, setAccent } = useTheme();
  return (
    <SegmentedControl
      ariaLabel="Accent"
      value={accent}
      options={ACCENT_OPTIONS}
      onValueChange={(next) => {
        setAccent(next);
        onChange?.(next);
      }}
    />
  );
}

export function MotionSetting() {
  const { motion, setMotion } = useTheme();
  return (
    <SwitchRow
      id="reduce-motion"
      title="Reduce motion"
      description="Fewer animations. On automatically when your device asks for it."
      checked={motion === "reduce"}
      onCheckedChange={(on) => setMotion(on ? "reduce" : "system")}
    />
  );
}
