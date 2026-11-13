"use client";

import * as React from "react";
import { RadioGroup } from "radix-ui";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Accessible name when `label` is an icon only. */
  ariaLabel?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  /** Names the group, e.g. "Range" or "Report mode". */
  ariaLabel: string;
  /** `md` matches a default field or button; `sm` a toolbar control. */
  size?: "sm" | "md";
  /** Stretch segments to fill the width (phones). */
  fullWidth?: boolean;
  className?: string;
}

/**
 * One choice from a few (Today / Week / Month / Year; Light / Dark / System). Applies at once (no Save).
 * A radio group: Tab focuses the selection, arrow keys move it. The selection is marked twice:
 * a raised surface and darker text. For more than about five options use a Select.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  size = "md",
  fullWidth = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      aria-label={ariaLabel}
      orientation="horizontal"
      loop
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-md bg-neutral-100 p-0.5 [scrollbar-width:none]",
        fullWidth ? "flex w-full" : "w-fit",
        className,
      )}
    >
      {options.map((option) => (
        <RadioGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          aria-label={option.ariaLabel}
          data-touch-target
          className={cn(
            "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-sm px-3 whitespace-nowrap text-muted-foreground transition-colors",
            "hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
            "data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:shadow-raised dark:data-[state=checked]:bg-neutral-300",
            "[&_svg]:size-3.5 [&_svg]:shrink-0",
            size === "sm" ? "h-6 text-caption max-md:h-8" : "h-7 text-body max-md:h-9",
            fullWidth ? "min-w-0 flex-1" : "shrink-0",
          )}
        >
          {option.icon}
          {option.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
