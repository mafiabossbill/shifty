import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The content column inside <main>. `default` is the work area (lists, Home, Insights: up to 1152px);
 * `narrow` is for forms, settings and anything read top to bottom (672px), so lines and fields never
 * stretch. The page edge is 16px on phones and 24px from tablets up (`px-page`).
 * The column starts at the left edge, under the place's name in the top bar: one left edge for the
 * whole screen. It is not centred, so nothing floats in the middle of a wide window.
 */
export function Page({ children, width = "default", className }: { children: React.ReactNode; width?: "default" | "narrow"; className?: string }) {
  return <div className={cn("w-full px-page pt-4 pb-12 md:pt-6", width === "default" ? "max-w-6xl" : "max-w-2xl", className)}>{children}</div>;
}

/**
 * The page's <h1>, plus an optional line and actions. The top bar already shows the place's name on
 * every width, so the heading itself is for screen readers only; a title is a label for the content,
 * not the content. The description and the actions are what show: side by side from 768px (actions
 * at the right edge), stacked on phones (the line, then the actions).
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
  const visible = Boolean(description || actions);
  return (
    <header className={cn(visible && "mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-center md:gap-4", className)}>
      <h1 className="sr-only">{title}</h1>
      {description ? <p className="max-w-prose min-w-0 text-muted-foreground">{description}</p> : null}
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 md:ml-auto">{actions}</div> : null}
    </header>
  );
}

/** A titled group of content on a page (h2 + optional action). Sections sit 32px apart (`gap-8` on their parent). */
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
        <div className="flex min-h-8 items-center gap-3">
          {title ? <h2 className="text-title font-semibold">{title}</h2> : null}
          {action ? <div className="ml-auto">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
