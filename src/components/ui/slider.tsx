"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * A single-value slider (goal hours, mood, energy). Arrow keys step, PageUp/PageDown jump.
 * Give it an aria-label and, when the number isn't obvious, `valueText` (read out instead of the raw number).
 * Show the chosen value in words next to it: the thumb's position alone is not an answer.
 */
function Slider({
  className,
  value,
  defaultValue,
  onValueChange,
  valueText,
  "aria-label": ariaLabel,
  ...props
}: Omit<React.ComponentProps<typeof SliderPrimitive.Root>, "value" | "defaultValue" | "onValueChange"> & {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  valueText?: string;
  "aria-label": string;
}) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value === undefined ? undefined : [value]}
      defaultValue={defaultValue === undefined ? undefined : [defaultValue]}
      onValueChange={onValueChange ? (values) => onValueChange(values[0] ?? 0) : undefined}
      className={cn("relative flex h-8 w-full touch-none items-center select-none data-disabled:opacity-50 max-md:h-10", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-neutral-200">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-neutral-800" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        aria-valuetext={valueText}
        data-touch-target
        className="block size-5 cursor-grab rounded-full border border-control bg-background shadow-raised active:cursor-grabbing dark:bg-neutral-900"
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
