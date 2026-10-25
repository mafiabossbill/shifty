import * as React from "react";

import { cn } from "@/lib/utils";

/** Date and time fields with nothing picked; browsers (Safari) draw a sample value in them. */
const PICKER_TYPES = new Set(["date", "time", "datetime-local", "month", "week"]);

/** Shared field look: Input, Textarea and Select. 44px on phones (16px text, no iOS zoom), 40px from tablets. */
export const fieldClass = cn(
  "w-full min-w-0 rounded-control border border-input bg-raised px-3.5 text-sm text-foreground transition-[border-color,box-shadow,background-color] outline-none",
  "placeholder:text-muted-foreground/80 hover:border-border-strong",
  "focus-visible:border-brand focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-brand/15 focus-visible:outline-none",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "aria-invalid:border-danger aria-invalid:ring-danger/15",
);

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  // An empty picker shows its sample value like a placeholder: muted until focused or filled.
  const emptyPicker = type !== undefined && PICKER_TYPES.has(type) && (props.value ?? props.defaultValue ?? "") === "";
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldClass, "flex h-11 py-2 md:h-10", emptyPicker && "text-muted-foreground focus:text-foreground", className)}
      {...props}
    />
  );
}

export { Input };
