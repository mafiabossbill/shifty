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
  size?: "sm" | "md";
  /** Stretch segments to fill the width (phones). */
  fullWidth?: boolean;
  className?: string;
}

/**
 * One choice from a few (Today / Week / Month / Year; Allocate to days / Group by start date).
 * A radio group: Tab focuses the selection, arrow keys move it. Selecting applies at once (no Save).
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
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-control border border-border bg-raised p-1 [scrollbar-width:none]",
        fullWidth && "flex w-full",
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
            "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[10px] px-3 font-medium whitespace-nowrap text-muted-foreground transition-[background-color,color,box-shadow] duration-150",
            "hover:text-foreground focus-ring disabled:cursor-not-allowed disabled:opacity-50",
            "data-[state=checked]:bg-card data-[state=checked]:text-foreground data-[state=checked]:shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_var(--border)]",
            "dark:data-[state=checked]:bg-accent dark:data-[state=checked]:shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]",
            "[&_svg]:size-4 [&_svg]:shrink-0",
            size === "sm" ? "h-8 text-xs md:h-7" : "h-10 text-sm md:h-9",
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
