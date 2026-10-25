import * as React from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** One sentence: what will be here. */
  title: string;
  /** Optional second line, only if it tells people something the title doesn't. */
  description?: string;
  /** One action (a Button). */
  action?: React.ReactNode;
  /** A lucide icon in a soft circle. No illustrations. */
  icon?: React.ReactNode;
  /** "card" stands alone on a page; "inline" sits inside a card that already has a surface. */
  variant?: "card" | "inline";
  className?: string;
}

/** Minimal empty state: one sentence, one action. */
export function EmptyState({ title, description, action, icon, variant = "card", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "grid justify-items-center gap-2 px-5 py-10 text-center",
        variant === "card" && "rounded-card border border-dashed border-border-strong bg-card/50",
        className,
      )}
    >
      {icon ? (
        <span className="mb-1 inline-flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-strong [&_svg]:size-5" aria-hidden>
          {icon}
        </span>
      ) : null}
      <p className="max-w-sm font-display text-base font-medium text-balance">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
