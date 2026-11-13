import { cn } from "@/lib/utils";

/**
 * Placeholder with the same size as what is loading (never a spinner). A slow pulse while it
 * waits; still when motion is reduced. Give it the shape of the real thing with a height and width.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("rounded-md bg-neutral-200 motion-safe:animate-pulse", className)} {...props} />;
}
