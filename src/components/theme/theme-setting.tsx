"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";
import type { Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

/** Segmented control: saves on click (no Save button for a preference). */
export function ThemeSetting() {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Appearance" className="inline-flex w-fit gap-px rounded-md border bg-border p-px">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          data-touch-target
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-[5px] bg-background px-2.5 text-xs text-muted-foreground max-md:h-9",
            theme === value && "bg-accent font-medium text-foreground",
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
