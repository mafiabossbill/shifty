import Link from "next/link";

import { BrandLockup } from "@/components/shell/brand-mark";
import { APP_CONFIG } from "@/lib/app-config";
import { LEGAL_LINKS } from "@/lib/legal";
import { supabaseConfigured } from "@/lib/supabase/env";

/** Sign-in, sign-up and password pages: brand, one card with one form, legal links reachable signed out. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background px-[max(1rem,env(safe-area-inset-left,0px))] pt-[max(2.5rem,env(safe-area-inset-top,0px))] pb-[max(2rem,env(safe-area-inset-bottom,0px))]">
      {/* The one radial glow: quiet, behind the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-12rem] left-1/2 size-[36rem] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, var(--glow), transparent 70%)" }}
      />
      <div className="relative mx-auto flex w-full max-w-sm items-center">
        <Link href="/" className="rounded-lg focus-ring" aria-label="SHIFTY home">
          <BrandLockup />
        </Link>
      </div>
      <main className="relative mx-auto mt-10 w-full max-w-sm rounded-card border border-border bg-card p-6 shadow-card md:mt-14 md:p-8">
        {supabaseConfigured() ? children : <SyncNotSetUp />}
      </main>
      <nav aria-label="Legal" className="relative mx-auto mt-auto flex w-full max-w-sm flex-wrap gap-x-4 gap-y-2 pt-12 text-xs text-muted-foreground">
        {LEGAL_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="rounded hover:text-foreground focus-ring">
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
