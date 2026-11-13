"use client";

import { usePathname } from "next/navigation";

import { SyncStatusSlot } from "@/components/shell/slots";
import { titleFor } from "@/lib/nav";

/*
 * The bar above every screen: where you are (the place's name, small) on the left, the device's
 * sync state on the right. 50px tall, plus the status bar's height when the installed app draws under it.
 * The visible title here is aria-hidden: every page renders its own <h1> (PageHeader), so the
 * name is announced once.
 */
const barClass = "order-0 flex min-h-[calc(3.125rem+env(safe-area-inset-top,0px))] shrink-0 items-center gap-3 border-b bg-background px-page pt-safe";

/** The bar for a given path; `null` (URL not known yet) shows it bare, so it can be prerendered. */
export function TopBarFrame({ pathname = null, children }: { pathname?: string | null; children?: React.ReactNode }) {
  return (
    <header className={barClass}>
      <span aria-hidden className="min-w-0 truncate text-title font-semibold">
        {titleFor(pathname)}
      </span>
      {children ? <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div> : null}
    </header>
  );
}

export function TopBar() {
  return (
    <TopBarFrame pathname={usePathname()}>
      <SyncStatusSlot />
    </TopBarFrame>
  );
}
