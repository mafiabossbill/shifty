import * as React from "react";

import { fieldClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Grows with its content (field-sizing), from three lines. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldClass, "flex field-sizing-content min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
}

export { Textarea };
