"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandLockup } from "@/components/shell/brand-mark";
import { NavIcon } from "@/components/shell/nav-icon";
import { LEGAL_LINKS } from "@/lib/legal";
import { MAIN_NAV, isActivePath } from "@/lib/nav";
import { cn } from "@/lib/utils";

const itemClass = "flex h-8 items-center gap-2 rounded-md px-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground";
/** The current place is marked twice: a quieter surface and a heavier, darker label. */
const activeClass = "bg-sidebar-accent font-semibold text-foreground";

/** From 1024px: the logo, the five places, quiet legal links. */
export function Sidebar() {
  return <SidebarFrame pathname={usePathname()} />;
}

/** The sidebar for a given path; `null` (URL not known yet) shows it with no current item, so it can be prerendered. */
export function SidebarFrame({ pathname = null }: { pathname?: string | null }) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar pl-safe lg:flex">
      <div className="flex h-12.5 shrink-0 items-center px-4">
        <Link href="/" className="rounded-md" aria-label="SHIFTY home">
          <BrandLockup />
        </Link>
      </div>
      <nav className="flex flex-col gap-0.5 px-2 pt-2" aria-label="Main">
        {MAIN_NAV.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn(itemClass, active && activeClass)}>
              <NavIcon icon={item.icon} className={cn("size-4", !active && "text-muted-foreground")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <nav aria-label="Legal" className="mt-auto flex flex-wrap gap-x-3 gap-y-1 p-4 text-caption text-muted-foreground">
        {LEGAL_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-sm hover:text-foreground hover:underline">
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
