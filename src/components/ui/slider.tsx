"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * A single-value slider (goal hours, mood, energy). Arrow keys step, PageUp/PageDown jump.
 * Give it an aria-label and, when the number isn't obvious, `valueText` (read out instead of the raw number).
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
      className={cn("relative flex h-11 w-full touch-none items-center select-none data-disabled:opacity-50", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-track">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-brand" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        aria-valuetext={valueText}
        className="block size-6 cursor-grab rounded-full border-2 border-brand bg-white shadow-[0_1px_4px_rgb(0_0_0/0.25)] transition-[box-shadow] focus-ring active:cursor-grabbing"
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
