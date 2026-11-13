import { SignUpForm } from "@/components/auth/auth-forms";
import { AuthFrame } from "@/components/auth/auth-frame";
import { AuthHeading } from "@/components/auth/auth-heading";

/** The sign-up page as it looks on a deployment with sync set up (src/app/(auth)/signup). */
export default function Page() {
  return (
    <AuthFrame>
      <AuthHeading title="Create your account">You&apos;ll get access once an admin adds you to the team.</AuthHeading>
      <SignUpForm />
    </AuthFrame>
  );
}
