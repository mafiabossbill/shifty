import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { fieldClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A native <select>: phones get the system picker (the best one there is), keyboards and screen
 * readers get the platform behaviour. Children are plain <option>s.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div data-slot="select" className={cn("relative w-full", className)}>
      <select className={cn(fieldClass, "h-11 cursor-pointer appearance-none py-2 pr-10 md:h-10")} {...props}>
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  );
}

export { Select };
