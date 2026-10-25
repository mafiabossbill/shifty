"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavIcon } from "@/components/shell/nav-icon";
import { WorkspaceSwitcher, type WorkspaceOption } from "@/components/shell/workspace-switcher";
import { APP_CONFIG } from "@/lib/app-config";
import { SETTINGS_NAV, visibleNav, type NavItem } from "@/lib/nav";
import type { Capability } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const itemClass =
  "flex h-7 items-center gap-2.5 rounded-md px-2 text-[13px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent active:bg-sidebar-accent";
/** In the phone sheet: full-size touch targets. */
const touchItemClass = "h-11 text-sm";
const activeClass = "bg-sidebar-accent font-medium text-foreground";

export function Sidebar(props: {
  organizationName: string;
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string;
  capabilities: Capability[];
  touch?: boolean;
  className?: string;
}) {
  return <SidebarFrame {...props} pathname={usePathname()} />;
}

/** The sidebar without reading the URL, so it can be the prerendered loading fallback. */
export function SidebarFrame({
  organizationName = "",
  workspaces,
  activeWorkspaceId = "",
  capabilities = [],
  pathname = null,
  touch,
  className,
}: {
  organizationName?: string;
  /** Present once the session has loaded: the name becomes the workspace switcher. */
  workspaces?: WorkspaceOption[];
  activeWorkspaceId?: string;
  capabilities?: Capability[];
  pathname?: string | null;
  touch?: boolean;
  className?: string;
}) {
  const isActive = (href: string) => pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
  const link = (item: NavItem) => (
    <Link key={item.href} href={item.href} className={cn(itemClass, touch && touchItemClass, isActive(item.href) && activeClass)}>
      <NavIcon icon={item.icon} className="size-3.5 text-muted-foreground" />
      {item.label}
    </Link>
  );
  return (
    <aside className={cn("hidden w-56 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar md:flex", className)}>
      <div className="flex h-[50px] shrink-0 items-center gap-2 px-4">
        <span
          className="flex size-5 items-center justify-center rounded-[5px] text-[10px] font-bold text-white"
          style={{ backgroundColor: APP_CONFIG.brandColor }}
          aria-hidden
        >
          {APP_CONFIG.shortName.slice(0, 1)}
        </span>
        <span className="text-[13px] font-semibold">{APP_CONFIG.shortName}</span>
        {workspaces ? (
          <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} className="ml-auto max-w-28" />
        ) : (
          <span className="ml-auto max-w-24 truncate text-[11px] text-muted-foreground">{organizationName}</span>
        )}
      </div>
      <nav className="flex flex-col gap-px px-2 pt-1" aria-label="Main">
        {visibleNav(capabilities).map(link)}
      </nav>
      <nav className="mt-auto flex flex-col gap-px px-2 pt-4 pb-4" aria-label="Settings">
        {link(SETTINGS_NAV)}
      </nav>
    </aside>
  );
}
