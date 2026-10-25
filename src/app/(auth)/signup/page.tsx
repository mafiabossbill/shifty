import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/auth-forms";
import { SELF_SERVE } from "@/lib/app-config";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {SELF_SERVE
          ? "Confirm your email, then create your workspace or join one you've been invited to."
          : "You'll get access once an admin adds you to the team."}
      </p>
      <SignUpForm />
    </>
  );
}
