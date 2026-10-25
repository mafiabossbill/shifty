"use client";

import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { RadioGroup } from "radix-ui";

import { useTheme } from "@/components/theme/theme-provider";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SwitchRow } from "@/components/ui/switch";
import { ACCENTS, ACCENT_SWATCHES, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/*
 * Appearance controls. Each applies at once (no Save button for a preference). The settings lane
 * mounts these and also persists the choice to user_settings (theme, accent) for other devices.
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

export function AccentSetting({ onChange }: { onChange?: (accent: (typeof ACCENTS)[number]) => void }) {
  const { accent, setAccent, resolvedTheme } = useTheme();
  return (
    <RadioGroup.Root
      aria-label="Accent color"
      value={accent}
      onValueChange={(next) => {
        const value = next as (typeof ACCENTS)[number];
        setAccent(value);
        onChange?.(value);
      }}
      orientation="horizontal"
      loop
      className="flex flex-wrap gap-3"
    >
      {ACCENTS.map((value) => {
        const swatch = ACCENT_SWATCHES[value];
        return (
          <RadioGroup.Item
            key={value}
            value={value}
            data-touch-target
            className="group grid cursor-pointer justify-items-center gap-1.5 rounded-xl p-1 text-xs text-muted-foreground focus-ring data-[state=checked]:text-foreground"
          >
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-card transition-shadow",
                "group-data-[state=checked]:ring-foreground/70",
              )}
              style={{ backgroundColor: swatch[resolvedTheme] }}
            >
              <CheckIcon className="size-4 text-white opacity-0 dark:text-[#0c0a18] group-data-[state=checked]:opacity-100" strokeWidth={2.5} aria-hidden />
            </span>
            {swatch.label}
          </RadioGroup.Item>
        );
      })}
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
