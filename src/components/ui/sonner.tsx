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
          toast: "!rounded-[16px] !border-border !bg-popover !text-popover-foreground !shadow-raised !font-sans !text-sm !gap-3",
          title: "!font-medium",
          description: "!text-muted-foreground",
          actionButton: "!h-8 !rounded-[10px] !bg-primary !px-3 !text-primary-foreground !font-medium",
          cancelButton: "!h-8 !rounded-[10px] !bg-raised !px-3 !text-foreground",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-danger",
          warning: "[&_[data-icon]]:!text-warning",
          info: "[&_[data-icon]]:!text-info",
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
