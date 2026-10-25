import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";

import { AccountData } from "@/components/account/account-data";
import { requireSession } from "@/lib/current-user";
import { LEGAL_LINKS } from "@/lib/legal";

export const metadata: Metadata = { title: "Your data" };

/** Access, portability and erasure in one place (privacy policy "Your rights"). */
export default async function AccountPage() {
  await connection();
  const { user } = await requireSession();
  return (
    <div className="mx-auto grid max-w-2xl gap-6 p-4 md:p-6">
      <section className="grid gap-1">
        <Link href="/settings" className="w-fit text-[13px] text-muted-foreground hover:text-foreground">
          ← Settings
        </Link>
        <h1 className="text-base font-semibold">Your data</h1>
        <p className="text-muted-foreground">Download everything we hold about you, or delete your account.</p>
      </section>
      <AccountData email={user.email} />
      <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
        {LEGAL_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-foreground">
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
