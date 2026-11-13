"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * On/off that applies at once (role="switch", Space toggles). For a choice applied with Save use a
 * checkbox instead. Label it with a <Label htmlFor> or aria-label; for settings rows use <SwitchRow>.
 * Off is the `control` grey (3:1 on the page), on is the action colour; the thumb's side is the second cue.
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-touch-target
      className={cn(
        "peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-150",
        "bg-control data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 rounded-full bg-background shadow-raised transition-transform duration-150 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
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
    <div className={cn("flex min-h-11 items-center gap-4 py-2", className)}>
      <label htmlFor={id} className="grid min-w-0 flex-1 cursor-pointer gap-0.5">
        <span className="font-semibold">{title}</span>
        {description ? <span id={`${id}-description`} className="text-caption text-muted-foreground">{description}</span> : null}
      </label>
      <Switch id={id} aria-describedby={description ? `${id}-description` : undefined} {...props} />
    </div>
  );
}

export { Switch, SwitchRow };
