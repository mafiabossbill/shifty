import Link from "next/link";

import { AuthFrame } from "@/components/auth/auth-frame";
import { AuthHeading } from "@/components/auth/auth-heading";
import { APP_CONFIG } from "@/lib/app-config";
import { supabaseConfigured } from "@/lib/supabase/env";

/** Sign-in, sign-up and password pages: the logo, one headline, one narrow form (AuthFrame). */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <AuthFrame>{supabaseConfigured() ? children : <SyncNotSetUp />}</AuthFrame>;
}

/** Device mode: no Supabase project on this deployment, so there are no accounts to sign in to. */
function SyncNotSetUp() {
  return (
    <>
      <AuthHeading title="Sync isn't set up on this deployment">
        You can still track everything: your sessions are saved on this device. Accounts and syncing between devices
        switch on once this deployment is connected to its database.
      </AuthHeading>
      <Link href="/" className="inline-flex min-h-11 items-center underline decoration-control underline-offset-4 hover:decoration-foreground md:min-h-0">
        Back to {APP_CONFIG.name}
      </Link>
    </>
  );
}
