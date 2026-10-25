import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The content column inside <main>. `default` = the dashboard width (1200px), `narrow` = forms and settings.
 * Side padding follows the safe areas in landscape.
 */
export function Page({ children, width = "default", className }: { children: React.ReactNode; width?: "default" | "narrow"; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto w-full pt-2 pb-10 pr-[max(1rem,env(safe-area-inset-right,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] md:px-6 lg:px-10 lg:pt-8 lg:pb-14",
        width === "default" ? "max-w-[1280px]" : "max-w-[720px] lg:max-w-[800px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The page's <h1> + one line + actions. On phones the top bar already shows the title, so the
 * heading is visually hidden there (still the page's heading for screen readers); the description
 * and actions stay.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const visibleOnPhone = Boolean(description || actions);
  return (
    <header className={cn("flex flex-wrap items-end gap-x-4 gap-y-3", visibleOnPhone ? "mb-5" : "max-lg:mb-0", "lg:mb-8", className)}>
      <div className="grid min-w-0 flex-1 gap-1">
        <h1 className="type-display max-lg:sr-only">{title}</h1>
        {description ? <p className="max-w-prose text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A titled group of content on a page (h2 + optional action). */
export function PageSection({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-3", className)}>
      {title || action ? (
        <div className="flex min-h-9 items-center gap-3">
          {title ? <h2 className="font-display text-base font-semibold tracking-tight lg:text-lg">{title}</h2> : null}
          {action ? <div className="ml-auto">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
