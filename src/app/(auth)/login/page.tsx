import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/auth-forms";
import { AuthHeading } from "@/components/auth/auth-heading";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <AuthHeading title="Sign in">Your sessions sync to every device you sign in on.</AuthHeading>
      {/* Reads ?next= and ?error=, so it renders at request time. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
