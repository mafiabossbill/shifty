import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * The one box. A box is the strongest grouping there is and the noisiest, so it goes only around a
 * distinct object (a session, a chart with its title) or a main region of the page. Never inside
 * another Card, and never around every group: group with space and alignment first, then a
 * divider (`border-t`), then a box (design standard §4).
 * Flat: a border, no shadow. `interactive` adds hover feedback when the whole card is a link or button.
 */
const cardVariants = cva("flex flex-col gap-4 rounded-lg border bg-card text-card-foreground", {
  variants: {
    padding: {
      none: "",
      sm: "p-3",
      md: "p-4",
      lg: "p-4 md:p-6",
    },
    interactive: {
      true: "cursor-pointer transition-colors hover:bg-accent active:bg-accent",
      false: "",
    },
  },
  defaultVariants: { padding: "md", interactive: false },
});

function Card({ className, padding, interactive, ...props }: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return <div data-slot="card" className={cn(cardVariants({ padding, interactive }), className)} {...props} />;
}

/** Title row: title (+ description) on the left, an optional action on the right. */
function CardHeader({ className, action, children, ...props }: React.ComponentProps<"div"> & { action?: React.ReactNode }) {
  return (
    <div data-slot="card-header" className={cn("flex items-start gap-3", className)} {...props}>
      <div className="grid min-w-0 flex-1 gap-0.5">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function CardTitle({ className, as: Tag = "h2", ...props }: React.ComponentProps<"h2"> & { as?: "h2" | "h3" | "p" }) {
  return <Tag data-slot="card-title" className={cn("text-title font-semibold", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("grid gap-3", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex flex-wrap items-center gap-2", className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, cardVariants };
