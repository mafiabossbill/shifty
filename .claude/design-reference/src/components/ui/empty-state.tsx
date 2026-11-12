import { cn } from "@/lib/utils";

/** Minimal empty state: one sentence of what this is, one action. No illustrations. */
export function EmptyState({ title, description, action, className }: { title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid justify-items-center gap-1 rounded-lg border border-dashed px-4 py-12 text-center", className)}>
      <p className="text-body font-semibold">{title}</p>
      {description ? <p className="max-w-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
