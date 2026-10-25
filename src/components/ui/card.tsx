import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * Surfaces. Use a Card for a group that belongs together (the hero, a chart, a recap),
 * not around every line: lists of sessions are rows inside one card, settings are rows.
 *   default  surface + border + soft shadow (light) / top highlight + faint glow (dark)
 *   raised   an inset well inside a card or page (chips of stats, a sub-panel)
 *   hero     the Home/Insights hero: same surface, room for the ring's radial glow
 *   ghost    no surface; keeps padding and radius for alignment
 * `interactive` adds hover/press feedback when the whole card is a link or button.
 */
const cardVariants = cva("relative flex flex-col gap-4 rounded-card text-card-foreground", {
  variants: {
    variant: {
      default: "border border-border bg-card shadow-card",
      raised: "bg-raised",
      hero: "overflow-hidden border border-border bg-card shadow-card",
      ghost: "",
    },
    padding: {
      none: "",
      sm: "p-4",
      md: "p-5 lg:p-6",
      lg: "p-6 lg:p-8",
    },
    interactive: {
      true: "cursor-pointer transition-[background-color,box-shadow,transform] duration-150 hover:border-border-strong motion-safe:active:scale-[0.995] focus-ring",
      false: "",
    },
  },
  defaultVariants: { variant: "default", padding: "md", interactive: false },
});

function Card({ className, variant, padding, interactive, ...props }: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return <div data-slot="card" className={cn(cardVariants({ variant, padding, interactive }), className)} {...props} />;
}

/** Title row: title (+ description) on the left, an optional action on the right. */
function CardHeader({ className, action, children, ...props }: React.ComponentProps<"div"> & { action?: React.ReactNode }) {
  return (
    <div data-slot="card-header" className={cn("flex items-start gap-3", className)} {...props}>
      <div className="grid min-w-0 flex-1 gap-0.5">{children}</div>
      {action ? <div className="-my-1 shrink-0">{action}</div> : null}
    </div>
  );
}

function CardTitle({ className, as: Tag = "h2", ...props }: React.ComponentProps<"h2"> & { as?: "h2" | "h3" | "p" }) {
  return <Tag data-slot="card-title" className={cn("font-display text-base font-semibold tracking-tight", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("grid gap-3", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex flex-wrap items-center gap-2", className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, cardVariants };
