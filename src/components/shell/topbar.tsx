"use client";

import { usePathname } from "next/navigation";
import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-actions";
import { titleFor } from "@/lib/nav";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

// pt-safe: clear of the status bar if the installed app draws under it (landscape notch too).
const headerClass =
  "flex min-h-[50px] shrink-0 items-center gap-2 border-b bg-background pt-safe pr-[max(1rem,env(safe-area-inset-right,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] md:px-5";

/** Loading state: the bare bar, without reading the URL (so it can be prerendered). */
export function TopbarFrame() {
  return <header className={headerClass} />;
}

export function Topbar({ user }: { user: { name: string; role: Role } }) {
  const pathname = usePathname();
  return (
    <header className={headerClass}>
      <span className="min-w-0 truncate text-sm font-semibold md:text-[13px] md:font-medium">{titleFor(pathname)}</span>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="hidden max-w-40 text-right leading-tight sm:block">
          <div className="truncate text-xs font-medium">{user.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</div>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="icon-sm" title="Sign out" aria-label="Sign out">
            <LogOutIcon className="size-3.5" />
          </Button>
        </form>
      </div>
    </header>
  );
}
