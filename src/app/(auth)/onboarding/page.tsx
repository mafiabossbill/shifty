import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

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
      <h1 className="text-xl font-semibold tracking-tight">Create a workspace</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        A workspace holds your team&apos;s data. You can invite people once it&apos;s set up.
      </p>
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
      <form action={signOut} className="mt-6 text-center">
        <p className="text-[13px] text-muted-foreground">Signed in as {state.email}</p>
        <Button type="submit" variant="link" size="sm">
          Sign out
        </Button>
      </form>
    </>
  );
}
