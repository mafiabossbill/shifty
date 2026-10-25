"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTheme } from "@/components/theme/theme-provider";

function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      // Phones: above the bottom navigation bar and the home indicator.
      mobileOffset={{ bottom: "calc(var(--bottom-nav-height, 0px) + env(safe-area-inset-bottom, 0px) + 12px)", left: 12, right: 12 }}
      toastOptions={{
        classNames: {
          toast: "!text-[13px] !rounded-lg !border-border !shadow-md",
          description: "!text-muted-foreground",
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
