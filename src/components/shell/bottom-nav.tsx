"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavIcon } from "@/components/shell/nav-icon";
import { MAIN_NAV, isActivePath } from "@/lib/nav";
import { cn } from "@/lib/utils";

/*
 * Phones and tablets (below 1024px): a flat bar with the five places, within thumb reach, clear of
 * the home indicator. In the layout's flex column (not fixed), so content and sheets never hide
 * behind it. The current tab is marked twice: darker text and a heavier label.
 * Five tabs, not four and a More sheet: SHIFTY has exactly five places (factory/DECISIONS.md D18).
 */

const tabClass = "flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-micro text-muted-foreground transition-colors hover:text-foreground active:bg-accent";
const activeTabClass = "font-semibold text-foreground";

/** The bar for a given path; `null` (URL not known yet) shows the same tabs with none current. */
export function BottomNavFrame({ pathname = null }: { pathname?: string | null }) {
  return (
    <nav aria-label="Primary" className="order-4 shrink-0 border-t bg-background px-safe pb-safe lg:hidden">
      <div className="mx-auto flex h-14 max-w-lg items-stretch">
        {MAIN_NAV.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn(tabClass, active && activeTabClass)}>
              <NavIcon icon={item.icon} className="size-5" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function BottomNav() {
  return <BottomNavFrame pathname={usePathname()} />;
}
