import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Welcome back.</p>
      {/* Reads ?next= and ?error=, so it renders at request time. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
