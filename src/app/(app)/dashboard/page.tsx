import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { NavIcon } from "@/components/shell/nav-icon";
import { requireSession } from "@/lib/current-user";
import { SETTINGS_NAV, visibleNav } from "@/lib/nav";
import { ROLE_LABELS, viewerCapabilities } from "@/lib/permissions";

export const metadata: Metadata = { title: "Home" };

/**
 * The role's home. Replace with the product's real home (the core loop's starting point);
 * keep it information over decoration: numbers that link to the rows behind them, no charts for their own sake.
 */
export default async function DashboardPage() {
  await connection();
  const { user, organization } = await requireSession();
  const links = [...visibleNav(viewerCapabilities(user)).filter((item) => item.href !== "/dashboard"), SETTINGS_NAV];

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-base font-semibold">Hello, {user.name.split(" ")[0]}</h1>
        <p className="text-muted-foreground">
          {organization.name} · {ROLE_LABELS[user.role]}
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {links.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/60 active:bg-accent">
              <NavIcon icon={item.icon} className="size-4 text-muted-foreground" />
              <span className="font-medium">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
