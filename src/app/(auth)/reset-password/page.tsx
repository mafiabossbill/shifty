import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-rules";

export const metadata: Metadata = { title: "Choose a new password" };

/** Reached from the reset email; the form signs in with the link's tokens first. */
export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
      <ResetPasswordForm />
    </>
  );
}
