"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/*
 * Sheets: detail and edit surfaces that keep the page in place.
 *   side="responsive" (default)  phones: bottom sheet with a grab handle · ≥768px: a floating right drawer
 *   side="bottom" | "right" | "left"  fixed placement (left = navigation)
 * Structure: <SheetContent><SheetHeader><SheetTitle/><SheetDescription/></SheetHeader>
 *            <SheetBody>…scrolls…</SheetBody><SheetFooter>actions</SheetFooter></SheetContent>
 * Always give a SheetTitle (use className="sr-only" to hide it) for screen readers.
 */

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal(props: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
}

type Side = "responsive" | "bottom" | "right" | "left";

const BOTTOM =
  "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[28px] border-t pb-safe px-safe data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom";
const RIGHT =
  "inset-y-0 right-0 h-full w-[min(440px,100vw)] border-l pt-safe pr-safe pb-safe data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right";

const SIDES: Record<Side, string> = {
  bottom: BOTTOM,
  right: RIGHT,
  left: "inset-y-0 left-0 h-full w-[min(320px,85vw)] border-r pt-safe pb-safe pl-safe data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
  responsive: cn(
    BOTTOM,
    // ≥768px: a floating drawer on the right, clear of the screen edges.
    "md:inset-x-auto md:top-3 md:right-3 md:bottom-3 md:max-h-none md:w-[440px] md:rounded-card md:border md:pb-0",
    "md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=closed]:slide-out-to-right md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=open]:slide-in-from-right",
  ),
};

function SheetContent({
  className,
  children,
  side = "responsive",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: Side;
  showCloseButton?: boolean;
}) {
  const hasHandle = side === "bottom" || side === "responsive";
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col border-border bg-popover text-popover-foreground shadow-raised outline-none",
          "data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=open]:duration-300 data-[state=open]:ease-out",
          SIDES[side],
          className,
        )}
        {...props}
      >
        {hasHandle ? (
          <div className={cn("flex shrink-0 justify-center pt-2.5 pb-1", side === "responsive" && "md:hidden")} aria-hidden>
            <span className="h-1.5 w-10 rounded-full bg-border-strong" />
          </div>
        ) : null}
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-touch-target
            className={cn(
              "absolute top-3 right-3 inline-flex size-9 cursor-pointer items-center justify-center rounded-full bg-raised text-muted-foreground transition-colors hover:text-foreground focus-ring",
              (side === "right" || side === "left") && "top-[calc(0.75rem+env(safe-area-inset-top,0px))]",
              hasHandle && "top-4",
            )}
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex shrink-0 flex-col gap-1 px-5 pt-3 pb-3 pr-14 md:pt-5", className)} {...props} />;
}

/** The scrolling middle. */
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-body" data-scroll-area className={cn("min-h-0 flex-1 overflow-y-auto px-5 pb-5", className)} {...props} />;
}

/** Actions pinned to the bottom (the sheet itself clears the home indicator). Primary action last (right / bottom on phones). */
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex shrink-0 flex-col-reverse gap-2 border-t border-border px-5 pt-3 pb-3 sm:flex-row sm:justify-end md:pb-4",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" className={cn("type-title text-foreground", className)} {...props} />;
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description data-slot="sheet-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export { Sheet, SheetBody, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger };
