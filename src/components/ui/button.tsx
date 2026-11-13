import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * Buttons are styled by rank, not by meaning (design standard §8). Every action is a real <Button>.
 *   default      primary: solid. The one action this screen or dialog exists for. At most one per screen.
 *   outline      secondary: same shape, an edge instead of a fill. Everything else worth a button.
 *   link         tertiary: underlined text. Low-stakes actions (Cancel, Clear filters).
 *   ghost        no edge at rest: icon-only buttons and actions inside a row, menu or toolbar.
 *   destructive  red fill, and only as the confirm button inside useConfirm(). Before that step a
 *                delete is an ordinary outline or link button, labelled with what it deletes.
 * There is no grey-filled and no tinted button: one reads as disabled, the other as decoration.
 * Labels are a verb and a noun ("Clock in", "Save session"). A button is disabled only while its
 * own request runs, or with the reason written beside it.
 * Sizes: default for forms and dialogs · sm for toolbars · xs for in-row actions · lg for the one
 * main action of a phone screen (44px tall there) · icon-* for icon-only buttons (need an aria-label).
 * On any touch screen the hit area is at least 44px whatever the size (globals.css).
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md text-body font-semibold whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-raised hover:bg-primary/90 active:bg-primary/80",
        destructive: "bg-destructive-strong text-white shadow-raised hover:bg-destructive-strong/90 active:bg-destructive-strong/80",
        outline: "border border-control bg-background shadow-raised hover:bg-accent hover:text-accent-foreground active:bg-accent dark:bg-input/30 dark:hover:bg-accent",
        ghost: "font-normal hover:bg-accent hover:text-accent-foreground active:bg-accent",
        link: "text-foreground underline decoration-control underline-offset-4 hover:decoration-foreground",
      },
      // Phones get a step up; on any touch screen the hit area is at least 44px (globals.css).
      size: {
        default: "h-8 px-3 max-md:h-10 max-md:px-4",
        xs: "h-6 gap-1 px-2 text-caption max-md:h-8 max-md:px-3 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 px-3 text-caption max-md:h-9 max-md:px-3",
        lg: "h-9 px-4 max-md:h-11",
        icon: "size-8 max-md:size-10",
        "icon-sm": "size-7 max-md:size-9",
        "icon-xs": "size-6 max-md:size-8 [&_svg:not([class*='size-'])]:size-3",
      },
    },
    // A link is text: no side padding, so it lines up with the text above it. Its height still follows the size.
    compoundVariants: [{ variant: "link", className: "px-0 max-md:px-0" }],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a next/link <Link>) with button styles. */
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      // Radix triggers (`DropdownMenuTrigger asChild`…) replace data-slot with their own; this attribute survives the
      // merge, so the 44px touch hit area in globals.css applies to every Button.
      data-touch-target=""
      // A <button> inside a <form> submits by default; make that an explicit choice.
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants, type ButtonProps };
