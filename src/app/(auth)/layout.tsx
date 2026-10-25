import Link from "next/link";

import { APP_CONFIG } from "@/lib/app-config";
import { LEGAL_LINKS } from "@/lib/legal";
import { supabaseConfigured } from "@/lib/supabase/env";

/** Sign-in, sign-up and password pages: a quiet brand header and one form. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-background px-[max(1rem,env(safe-area-inset-left,0px))] pt-[max(2.5rem,env(safe-area-inset-top,0px))] pb-[max(2.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto flex w-full max-w-sm items-center gap-2">
        <span
          className="flex size-6 items-center justify-center rounded-md text-[11px] font-bold text-white"
          style={{ backgroundColor: APP_CONFIG.brandColor }}
          aria-hidden
        >
          {APP_CONFIG.shortName.slice(0, 1)}
        </span>
        <span className="text-[13px] font-semibold">{APP_CONFIG.name}</span>
      </div>
      <main className="mx-auto mt-12 w-full max-w-sm">{supabaseConfigured() ? children : <SyncNotSetUp />}</main>
      <nav aria-label="Legal" className="mx-auto mt-auto flex w-full max-w-sm flex-wrap gap-x-4 gap-y-2 pt-12 text-[12px] text-muted-foreground">
        {LEGAL_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-foreground">
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Device mode: no Supabase project on this deployment, so there are no accounts to sign in to. */
function SyncNotSetUp() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Sync isn&apos;t set up on this deployment</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        You can still track everything: your sessions are saved on this device. Accounts and syncing between devices
        switch on once this deployment is connected to its database.
      </p>
      <Link href="/" className="text-sm font-medium underline underline-offset-4">
        Back to {APP_CONFIG.name}
      </Link>
    </>
  );
}
