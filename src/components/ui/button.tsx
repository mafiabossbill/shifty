import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * One button system. Every action is a real <Button>, never link-styled text.
 *   primary    the one main action of an area (Clock in, Save). `default` is an alias.
 *   secondary  supporting action with weight (Add break, Edit).
 *   soft       accent-tinted, a friendly second action (Retry location, Add note).
 *   ghost      low emphasis, dense or icon-only (Close, More).
 *   outline    toolbar controls (Filter, Export).
 *   danger     Delete / Discard / Empty trash; always behind useConfirm(). `destructive` is an alias.
 *   link       navigation inside prose only.
 * Sizes: sm (toolbars, rows) · md (forms, dialogs; default) · lg (sheet footers, phone CTAs)
 *        xl (THE big round CLOCK IN / CLOCK OUT) · icon-sm · icon · icon-lg (icon-only: needs aria-label).
 * Phones get 44px+ controls; on any touch screen the hit area is at least 44px (globals.css).
 */
const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium select-none",
    "transition-[background-color,color,box-shadow,transform,filter] duration-150 ease-out motion-safe:active:scale-[0.98]",
    "focus-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-primary hover:brightness-110 active:brightness-95",
        secondary: "border border-border bg-raised text-foreground hover:bg-accent active:bg-accent",
        soft: "bg-brand-soft text-brand-strong hover:bg-brand-soft/70 active:bg-brand-soft/60",
        ghost: "text-foreground hover:bg-accent active:bg-accent",
        outline: "border border-border-strong bg-transparent text-foreground hover:bg-accent active:bg-accent",
        danger: "bg-destructive-strong text-danger-foreground hover:brightness-110 active:brightness-95",
        link: "h-auto px-0 text-brand underline-offset-4 hover:underline",
        // Template aliases.
        default: "bg-primary text-primary-foreground shadow-primary hover:brightness-110 active:brightness-95",
        destructive: "bg-destructive-strong text-danger-foreground hover:brightness-110 active:brightness-95",
      },
      size: {
        sm: "h-10 px-3.5 text-sm md:h-9 md:px-3 md:text-[13px]",
        md: "h-11 px-5 text-sm md:h-10 md:px-4",
        lg: "h-13 px-6 text-base font-semibold md:h-12",
        xl: "h-18 min-w-56 rounded-full px-10 font-display text-lg font-semibold tracking-wide md:h-16 [&_svg:not([class*='size-'])]:size-5",
        "icon-sm": "size-10 md:size-9",
        icon: "size-11 md:size-10",
        "icon-lg": "size-13 rounded-full md:size-12 [&_svg:not([class*='size-'])]:size-5",
        // Template aliases.
        default: "h-11 px-5 text-sm md:h-10 md:px-4",
        xs: "h-8 gap-1 rounded-lg px-2.5 text-xs md:h-7 md:px-2 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-xs": "size-8 rounded-lg md:size-7 [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
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
      // A <button> inside a <form> submits by default; make that an explicit choice.
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants, type ButtonProps };
