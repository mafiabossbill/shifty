"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTheme } from "@/components/theme/theme-provider";

/**
 * Toasts: short confirmations ("Clocked in at 18:02") and recoverable undo ("Clocked out · Undo").
 * Errors that need action stay on the page (or in Needs attention), not only in a toast.
 * Phones: above the bottom bar and the home indicator. Desktop: bottom right.
 */
function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme}
      position="bottom-right"
      className="toaster group"
      offset={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)", right: 20 }}
      mobileOffset={{
        bottom: "calc(var(--bottom-nav-height, 0px) + env(safe-area-inset-bottom, 0px) + 12px)",
        left: "calc(env(safe-area-inset-left, 0px) + 12px)",
        right: "calc(env(safe-area-inset-right, 0px) + 12px)",
      }}
      toastOptions={{
        classNames: {
          toast: "gap-3! rounded-lg! border-border! bg-popover! font-sans! text-body! text-popover-foreground! shadow-overlay!",
          title: "font-semibold!",
          description: "text-muted-foreground!",
          actionButton: "h-7! rounded-md! bg-primary! px-3! font-semibold! text-primary-foreground! max-md:h-9!",
          cancelButton: "h-7! rounded-md! border! border-control! bg-transparent! px-3! text-foreground! max-md:h-9!",
          success: "[&_[data-icon]]:text-emerald-600!",
          error: "[&_[data-icon]]:text-red-600!",
          warning: "[&_[data-icon]]:text-amber-600!",
          info: "[&_[data-icon]]:text-blue-600!",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
