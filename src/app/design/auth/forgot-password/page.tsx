import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { AuthFrame } from "@/components/auth/auth-frame";
import { AuthHeading } from "@/components/auth/auth-heading";

/** The password-reset request as it looks on a deployment with sync set up (src/app/(auth)/forgot-password). */
export default function Page() {
  return (
    <AuthFrame>
      <AuthHeading title="Reset your password">We&apos;ll email you a link to choose a new one.</AuthHeading>
      <ForgotPasswordForm />
    </AuthFrame>
  );
}
