import type { Metadata } from "next";
import { connection } from "next/server";

import Link from "next/link";

import { ThemeSetting } from "@/components/theme/theme-setting";
import { requireSession } from "@/lib/current-user";
import { ROLE_LABELS, can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await connection();
  const { user, organization } = await requireSession();
  return (
    <div className="mx-auto grid max-w-2xl gap-6 p-4 md:p-6">
      <section className="grid gap-1">
        <h1 className="text-base font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          {user.email} · {ROLE_LABELS[user.role]} · {organization.name}
        </p>
      </section>
      {can(user, "member:manage") && (
        <Link href="/settings/team" className="grid gap-0.5 rounded-lg border p-4 hover:bg-accent/60">
          <span className="text-sm font-medium">Team</span>
          <span className="text-muted-foreground">Invite people, change roles, deactivate members.</span>
        </Link>
      )}
      <Link href="/settings/account" className="grid gap-0.5 rounded-lg border p-4 hover:bg-accent/60">
        <span className="text-sm font-medium">Your data</span>
        <span className="text-muted-foreground">Download your data or delete your account.</span>
      </Link>
      <section className="grid gap-2 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Appearance</h2>
        <ThemeSetting />
      </section>
    </div>
  );
}
