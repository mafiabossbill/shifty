import { Suspense } from "react";

import { LoginForm } from "@/components/auth/auth-forms";
import { AuthFrame } from "@/components/auth/auth-frame";
import { AuthHeading } from "@/components/auth/auth-heading";

/** Sign-in after the server refused it: the sentence the server returns, at the top of the form, the email kept. */
export default function Page() {
  return (
    <AuthFrame>
      <AuthHeading title="Sign in">Your sessions sync to every device you sign in on.</AuthHeading>
      <Suspense>
        <LoginForm initialState={{ error: "Email or password is incorrect.", email: "bill@example.com" }} />
      </Suspense>
    </AuthFrame>
  );
}
