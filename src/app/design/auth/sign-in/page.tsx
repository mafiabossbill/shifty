import { Suspense } from "react";

import { LoginForm } from "@/components/auth/auth-forms";
import { AuthFrame } from "@/components/auth/auth-frame";
import { AuthHeading } from "@/components/auth/auth-heading";

/** The sign-in page as it looks on a deployment with sync set up (src/app/(auth)/login). For looking, not for signing in. */
export default function Page() {
  return (
    <AuthFrame>
      <AuthHeading title="Sign in">Your sessions sync to every device you sign in on.</AuthHeading>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
