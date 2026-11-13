import * as React from "react";

import { cn } from "@/lib/utils";

/** Date and time fields with nothing picked; browsers (Safari) draw a sample value in them. */
const PICKER_TYPES = new Set(["date", "time", "datetime-local", "month", "week"]);

/**
 * Shared field look: Input, Textarea and Select. 32px tall, 40px on phones (16px text there, so iOS
 * never zooms). The edge is `border-control`: a field's border carries meaning, so it holds 3:1.
 * Focus is the global ring (globals.css); an invalid field turns its edge red and says why above it (Field).
 */
export const fieldClass = cn(
  "w-full min-w-0 rounded-md border border-control bg-transparent px-3 text-body text-foreground shadow-raised transition-colors dark:bg-input/30",
  "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
  "aria-invalid:border-destructive",
);

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  // An empty picker shows its sample value like a placeholder: muted until focused or filled.
  const emptyPicker = type !== undefined && PICKER_TYPES.has(type) && (props.value ?? props.defaultValue ?? "") === "";
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldClass, "flex h-8 py-1 max-md:h-10", emptyPicker && "text-muted-foreground focus:text-foreground", className)}
      {...props}
    />
  );
}

export { Input };
