import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * Button conventions — every action is a real <Button>, never link-styled text:
 *   default      primary action of a view or dialog (New Task, Save, Approve); one per area.
 *   secondary    supporting action that still needs weight (Restore, Rename, Change…).
 *   outline      toolbar controls and row actions (Filter, Columns, Export, View).
 *   ghost        low-emphasis or dense actions (Clear, Reset, Discard, icon-only close/remove).
 *   destructive  Delete / Remove / Archive / Deactivate; always behind useConfirm().
 *   link         navigation inside prose only — not for actions.
 * Sizes: default for forms and dialogs, sm for toolbars, xs for in-row actions, icon-* for
 * icon-only buttons (these need an aria-label). Leading icons go before the label.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
        destructive: "bg-destructive-strong text-white shadow-xs hover:bg-destructive-strong/90 active:bg-destructive-strong/80",
        outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground active:bg-accent dark:bg-input/30 dark:hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70",
        ghost: "hover:bg-accent hover:text-accent-foreground active:bg-accent",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // Phones get a step up; on any touch screen the hit area is at least 44px (globals.css).
      size: {
        default: "h-8 px-3 max-md:h-10 max-md:px-4",
        xs: "h-6 gap-1 px-2 text-xs max-md:h-8 max-md:px-2.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 px-2.5 text-xs max-md:h-9 max-md:px-3",
        lg: "h-9 px-4 max-md:h-11",
        icon: "size-8 max-md:size-10",
        "icon-sm": "size-7 max-md:size-9",
        "icon-xs": "size-6 max-md:size-8 [&_svg:not([class*='size-'])]:size-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
