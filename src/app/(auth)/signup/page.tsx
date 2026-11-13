import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/auth-forms";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SELF_SERVE } from "@/lib/app-config";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <>
      <AuthHeading title="Create your account">
        {SELF_SERVE
          ? "Confirm your email, then create your workspace or join one you've been invited to."
          : "You'll get access once an admin adds you to the team."}
      </AuthHeading>
      <SignUpForm />
    </>
  );
}
