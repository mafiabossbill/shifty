"use client";

import { usePathname } from "next/navigation";

import { SyncStatusSlot } from "@/components/shell/slots";
import { titleFor } from "@/lib/nav";
import { cn } from "@/lib/utils";

/*
 * Phones/tablets: the page title, large, with the sync state on the right. From 1024px the page
 * header carries the big title, so the bar shows it small as a quiet location line.
 * The visible title here is aria-hidden: every page renders its own <h1> (PageHeader).
 * pt-safe: clear of the status bar when the installed app draws under it.
 */
const barClass = cn(
  "order-0 flex shrink-0 items-center gap-3 bg-background pt-safe",
  "min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pl-[max(1.25rem,env(safe-area-inset-left,0px))]",
  "md:pr-6 md:pl-6 lg:min-h-14 lg:border-b lg:border-border lg:px-10",
);

/** Loading state: the bare bar, without reading the URL (so it can be prerendered). */
export function TopBarFrame() {
  return <header className={barClass} />;
}

export function TopBar() {
  const pathname = usePathname();
  return (
    <header className={barClass}>
      <span aria-hidden className="min-w-0 truncate font-display text-[22px] font-semibold tracking-tight lg:text-sm lg:font-medium lg:tracking-normal lg:text-muted-foreground">
        {titleFor(pathname)}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <SyncStatusSlot />
      </div>
    </header>
  );
}
