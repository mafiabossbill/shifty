"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandLockup } from "@/components/shell/brand-mark";
import { NavIcon } from "@/components/shell/nav-icon";
import { LEGAL_LINKS } from "@/lib/legal";
import { MAIN_NAV, isActivePath } from "@/lib/nav";
import { cn } from "@/lib/utils";

const itemClass = cn(
  "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-sidebar-foreground",
  "transition-colors duration-150 hover:bg-sidebar-accent hover:text-foreground focus-ring",
);
const activeClass = "bg-brand-soft text-brand-strong hover:bg-brand-soft hover:text-brand-strong";

/** From 1024px: brand, the five places, quiet legal links. */
export function Sidebar() {
  return <SidebarFrame pathname={usePathname()} />;
}

/** The sidebar without reading the URL, so it can be the prerendered fallback. */
export function SidebarFrame({ pathname = null }: { pathname?: string | null }) {
  return (
    <aside className="hidden w-[232px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar pl-safe lg:flex">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link href="/" className="rounded-lg focus-ring" aria-label="SHIFTY home">
          <BrandLockup />
        </Link>
      </div>
      <nav className="flex flex-col gap-1 px-3 pt-4" aria-label="Main">
        {MAIN_NAV.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn(itemClass, active && activeClass)}>
              <NavIcon icon={item.icon} className={cn("size-[18px]", active ? "text-brand" : "text-muted-foreground")} strokeWidth={active ? 2.1 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <nav aria-label="Legal" className="mt-auto flex flex-wrap gap-x-3 gap-y-1 px-6 pt-6 pb-6 text-2xs text-muted-foreground">
        {LEGAL_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="rounded hover:text-foreground focus-ring">
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
