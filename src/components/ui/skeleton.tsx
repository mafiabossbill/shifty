import { cn } from "@/lib/utils";

/** Placeholder block for content that is still loading (theme tokens, so it follows dark mode). */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("animate-pulse rounded bg-muted", className)} {...props} />;
}
