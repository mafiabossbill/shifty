"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavIcon } from "@/components/shell/nav-icon";
import { MAIN_NAV, isActivePath } from "@/lib/nav";
import { cn } from "@/lib/utils";

/*
 * Phones and tablets (below 1024px): a floating rounded bar with the five places, within thumb
 * reach, clear of the home indicator. In the layout's flex column (not fixed), so content and
 * sheets never hide behind it. Active tab: tinted capsule + accent icon.
 */

const tabClass = cn(
  "flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-[18px] text-[0.6875rem] font-medium tracking-[-0.005em] text-muted-foreground",
  "transition-colors duration-150 hover:text-foreground focus-ring active:bg-accent",
);
const activeTabClass = "bg-brand-soft text-brand-strong hover:text-brand-strong";

function Bar({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Primary" className="order-4 shrink-0 px-[max(0.75rem,env(safe-area-inset-left,0px))] pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] lg:hidden">
      <div className="mx-auto flex h-16 max-w-lg items-stretch gap-0.5 rounded-[24px] border border-border bg-card/95 p-1.5 shadow-nav backdrop-blur-xl">
        {MAIN_NAV.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn(tabClass, active && activeTabClass)}>
              <NavIcon icon={item.icon} className="size-[22px]" strokeWidth={active ? 2.1 : 1.8} />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Same tabs, no active state: the prerendered fallback while the URL is unknown. */
export function BottomNavFrame() {
  return <Bar pathname={null} />;
}

export function BottomNav() {
  return <Bar pathname={usePathname()} />;
}
