import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthHeading } from "@/components/auth/auth-heading";
import { BrandLockup } from "@/components/shell/brand-mark";
import { Button } from "@/components/ui/button";
import { SELF_SERVE } from "@/lib/app-config";
import { signOut } from "@/lib/auth-actions";

export const metadata: Metadata = { title: "No access" };

/** Signed in, but not a member of any organization (yet). SaaS apps send people to /onboarding instead. */
export default function NoAccessPage() {
  if (SELF_SERVE) redirect("/onboarding");
  return (
    <div className="min-h-dvh px-page pt-[max(1rem,env(safe-area-inset-top,0px))] pb-12">
      <div className="mx-auto w-full max-w-sm">
        <span className="inline-flex min-h-11 items-center">
          <BrandLockup />
        </span>
        <main className="pt-8 md:pt-16">
          <AuthHeading title="You're signed in, but not part of a team yet">Ask an admin to add your email address, then sign in again.</AuthHeading>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </main>
      </div>
    </div>
  );
}
