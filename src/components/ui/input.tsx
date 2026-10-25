import * as React from "react";

import { cn } from "@/lib/utils";

/** Date and time fields with nothing picked; browsers (Safari) draw a sample value in them. */
const PICKER_TYPES = new Set(["date", "time", "datetime-local", "month", "week"]);

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  // An empty picker shows its sample value like a placeholder: muted until focused or filled.
  const emptyPicker =
    type !== undefined && PICKER_TYPES.has(type) && (props.value ?? props.defaultValue ?? "") === "";
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-[13px] shadow-xs max-md:h-10 dark:bg-input/30 transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        emptyPicker && "text-muted-foreground focus:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
