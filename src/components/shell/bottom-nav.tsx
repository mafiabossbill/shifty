"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";

import { NavIcon } from "@/components/shell/nav-icon";
import { Sidebar } from "@/components/shell/sidebar";
import type { WorkspaceOption } from "@/components/shell/workspace-switcher";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { MAIN_NAV, visibleNav, type NavItem } from "@/lib/nav";
import type { Capability } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/*
 * Phones only (below md): the main pages within thumb reach plus More (the full
 * sidebar as a sheet). Installed, the app has no browser toolbar and a top-left
 * menu is the hardest spot to reach one-handed. Tablets and desktops keep the sidebar.
 */

const tabClass =
  "flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium text-muted-foreground outline-none transition-colors active:bg-accent focus-visible:bg-accent";

function Bar({ items, pathname, children }: { items: NavItem[]; pathname: string | null; children?: React.ReactNode }) {
  return (
    <nav aria-label="Primary" className="shrink-0 border-t bg-background pb-safe px-safe md:hidden">
      <div className="flex h-(--bottom-nav-height)">
        {items.slice(0, 4).map((item) => {
          const active = pathname !== null && (pathname === item.href || pathname.startsWith(`${item.href}/`));
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn(tabClass, active && "text-foreground")}>
              <NavIcon icon={item.icon} className="size-5" strokeWidth={active ? 2 : 1.75} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        {children}
      </div>
    </nav>
  );
}

/** Same slots as the real bar, so nothing moves when it loads. */
export function BottomNavFrame() {
  return (
    <Bar items={MAIN_NAV} pathname={null}>
      <span className={tabClass} aria-hidden>
        <MenuIcon className="size-5" strokeWidth={1.75} />
        <span>More</span>
      </span>
    </Bar>
  );
}

export function BottomNav({
  organizationName,
  workspaces,
  activeWorkspaceId,
  capabilities,
}: {
  organizationName: string;
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string;
  capabilities: Capability[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  return (
    <Bar items={visibleNav(capabilities)} pathname={pathname}>
      <button type="button" className={tabClass} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <MenuIcon className="size-5" strokeWidth={1.75} />
        <span>More</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 max-w-[85vw] gap-0 p-0 sm:max-w-72" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">All pages</SheetDescription>
          {/* Any link click navigates, so close the sheet. */}
          <div className="h-full min-h-0" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
            <Sidebar
              organizationName={organizationName}
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              capabilities={capabilities}
              touch className="flex h-full w-full border-r-0" />
          </div>
        </SheetContent>
      </Sheet>
    </Bar>
  );
}
