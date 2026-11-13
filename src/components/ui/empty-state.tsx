import * as React from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** One sentence: what will appear here. */
  title: string;
  /** Optional second line, only if it tells people something the title doesn't. */
  description?: string;
  /** The first action (one Button), so the screen is never a dead end. */
  action?: React.ReactNode;
  /** "card" stands alone on a page; "inline" sits inside a Card, which already draws the box. */
  variant?: "card" | "inline";
  className?: string;
}

/**
 * An empty screen or section: what will appear here, and the first action. No illustration and no
 * icon: the sentence does the work. One of the few places text is centred (two short lines).
 */
export function EmptyState({ title, description, action, variant = "card", className }: EmptyStateProps) {
  return (
    <div className={cn("grid justify-items-center gap-1 px-4 py-12 text-center", variant === "card" && "rounded-lg border border-dashed", className)}>
      <p className="max-w-sm font-semibold text-balance">{title}</p>
      {description ? <p className="max-w-sm text-balance text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
