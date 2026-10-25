"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * On/off that applies at once (role="switch", Space toggles). Label it with a <Label htmlFor>
 * or aria-label. For settings rows use <SwitchRow>.
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-touch-target
      className={cn(
        "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 transition-colors duration-200 focus-ring",
        "bg-border-strong data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-6 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform duration-200 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

/** A settings row: title + optional description on the left, the switch on the right; the whole row is the label. */
function SwitchRow({
  id,
  title,
  description,
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & { id: string; title: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className={cn("flex min-h-14 items-center gap-4 py-2", className)}>
      <label htmlFor={id} className="grid min-w-0 flex-1 cursor-pointer gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        {description ? <span id={`${id}-description`} className="text-xs text-muted-foreground">{description}</span> : null}
      </label>
      <Switch id={id} aria-describedby={description ? `${id}-description` : undefined} {...props} />
    </div>
  );
}

export { Switch, SwitchRow };
