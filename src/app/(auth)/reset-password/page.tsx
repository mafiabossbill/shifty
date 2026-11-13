import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { AuthHeading } from "@/components/auth/auth-heading";

export const metadata: Metadata = { title: "Choose a new password" };

/** Reached from the reset email; the form signs in with the link's tokens first. */
export default function ResetPasswordPage() {
  return (
    <>
      <AuthHeading title="Choose a new password" />
      <ResetPasswordForm />
    </>
  );
}
