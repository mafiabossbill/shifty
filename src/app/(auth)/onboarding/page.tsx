import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AuthHeading } from "@/components/auth/auth-heading";
import { Button } from "@/components/ui/button";
import { CreateWorkspaceForm } from "@/components/workspaces/create-workspace-form";
import { SELF_SERVE } from "@/lib/app-config";
import { signOut } from "@/lib/auth-actions";
import { getSessionState } from "@/lib/current-user";

export const metadata: Metadata = { title: "Create a workspace" };

/** SaaS tenancy: where a signed-in person without a workspace lands, and "New workspace" from the switcher. */
export default function OnboardingPage() {
  if (!SELF_SERVE) redirect("/no-access");
  return (
    <>
      <AuthHeading title="Create a workspace">A workspace holds your team&apos;s data. You can invite people once it&apos;s set up.</AuthHeading>
      {/* Reads the session, so it renders at request time. */}
      <Suspense>
        <Onboarding />
      </Suspense>
    </>
  );
}

async function Onboarding() {
  const state = await getSessionState();
  if (state.status === "anonymous") redirect("/login?next=%2Fonboarding");
  if (state.status === "ok") return <CreateWorkspaceForm cancelHref="/dashboard" />;
  return (
    <>
      <CreateWorkspaceForm cancelHref={null} />
      <form action={signOut} className="mt-8 flex flex-wrap items-center gap-x-2 border-t pt-4 text-muted-foreground">
        <p>Signed in as {state.email}</p>
        <Button type="submit" variant="link">
          Sign out
        </Button>
      </form>
    </>
  );
}
