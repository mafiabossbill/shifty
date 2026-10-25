import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SELF_SERVE } from "@/lib/app-config";
import { signOut } from "@/lib/auth-actions";

export const metadata: Metadata = { title: "No access" };

/** Signed in, but not a member of any organization (yet). SaaS apps send people to /onboarding instead. */
export default function NoAccessPage() {
  if (SELF_SERVE) redirect("/onboarding");
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-base font-semibold">You&apos;re signed in, but not part of a team yet</h1>
        <p className="mt-1 text-muted-foreground">Ask an admin to add your email address, then sign in again.</p>
        <form action={signOut} className="mt-4">
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
