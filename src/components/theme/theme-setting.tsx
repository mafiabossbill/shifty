"use client";

import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { RadioGroup } from "radix-ui";

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

/**
 * The action colour: lilac, indigo, teal or peach. One at a time; choosing recolours the solid
 * button, links, the focus ring and the selected place in the menu at once. Each swatch carries
 * its own `data-accent`, so it shows its colour in the current theme straight from globals.css.
 * The choice is marked twice: a check in the swatch and a darker, heavier name.
 */
export function AccentSetting({ onChange }: { onChange?: (accent: Accent) => void }) {
  const { accent, setAccent } = useTheme();
  return (
    <RadioGroup.Root
      aria-label="Accent colour"
      value={accent}
      onValueChange={(next) => {
        const value = next as Accent;
        setAccent(value);
        onChange?.(value);
      }}
      orientation="horizontal"
      loop
      className="flex flex-wrap gap-2"
    >
      {ACCENTS.map((value) => (
        <RadioGroup.Item
          key={value}
          value={value}
          data-touch-target
          className="group flex h-8 cursor-pointer items-center gap-2 rounded-md border border-control bg-card pr-3 pl-2 text-muted-foreground shadow-raised transition-colors hover:text-foreground data-[state=checked]:font-semibold data-[state=checked]:text-foreground max-md:h-10 dark:bg-input/30"
        >
          <span data-accent={value} className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckIcon className="size-3 opacity-0 group-data-[state=checked]:opacity-100" strokeWidth={3} aria-hidden />
          </span>
          {ACCENT_LABELS[value]}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
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
