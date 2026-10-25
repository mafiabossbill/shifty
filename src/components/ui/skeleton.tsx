import { cn } from "@/lib/utils";

/**
 * Placeholder with the same size as what is loading (never a spinner). A slow pulse;
 * still when motion is reduced. Shapes: rounded block by default, `rounded-full` for rings/avatars.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("rounded-lg bg-raised motion-safe:animate-pulse", className)} {...props} />;
}
