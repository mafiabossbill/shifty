"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, signIn, signUp, updatePassword, type FormState } from "@/lib/auth-actions";
import { getBrowserClient } from "@/lib/supabase/client";

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.id}>{label}</Label>
      <Input {...props} />
    </div>
  );
}

function Status({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-[13px] text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.message) return <p className="text-[13px] text-muted-foreground">{state.message}</p>;
  return null;
}

const LINK_ERRORS: Record<string, string> = { link: "That link is invalid or has expired. Request a new one." };

export function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = React.useActionState(signIn, { error: LINK_ERRORS[params.get("error") ?? ""] });
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      <Field label="Email" id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} defaultValue={state.email} required autoFocus />
      <Field label="Password" id="password" name="password" type="password" autoComplete="current-password" required />
      <Status state={state} />
      <Button type="submit" disabled={pending} className="h-10">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <div className="flex justify-between text-[13px] text-muted-foreground">
        <Link href="/forgot-password" className="hover:text-foreground">
          Forgot password?
        </Link>
        <Link href="/signup" className="hover:text-foreground">
          Create account
        </Link>
      </div>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = React.useActionState(signUp, {});
  return (
    <form action={action} className="grid gap-4">
      <Field label="Full name" id="full_name" name="full_name" autoComplete="name" required />
      <Field label="Work email" id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} defaultValue={state.email} required />
      <Field label="Password" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      <Status state={state} />
      <Button type="submit" disabled={pending} className="h-10">
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-[12px] leading-5 text-muted-foreground">
        By creating an account you agree to the{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
          Terms of service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy policy
        </Link>
        .
      </p>
      <Link href="/login" className="text-[13px] text-muted-foreground hover:text-foreground">
        Already have an account? Sign in
      </Link>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = React.useActionState(requestPasswordReset, {});
  return (
    <form action={action} className="grid gap-4">
      <Field label="Email" id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} defaultValue={state.email} required autoFocus />
      <Status state={state} />
      <Button type="submit" disabled={pending} className="h-10">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <Link href="/login" className="text-[13px] text-muted-foreground hover:text-foreground">
        Back to sign in
      </Link>
    </form>
  );
}

/**
 * The reset email (implicit flow) lands here with the session in the URL #fragment.
 * Sign in with it once, then clear it from the address bar, so the link works in any
 * browser or device, not only the one that requested it.
 */
function useSessionFromFragment(): "pending" | "ready" | "invalid" {
  const [state, setState] = React.useState<"pending" | "ready" | "invalid">("pending");
  React.useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    let cancelled = false;
    void (async () => {
      if (accessToken && refreshToken) {
        const { error } = await getBrowserClient().auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        window.history.replaceState(null, "", window.location.pathname);
        if (!cancelled) setState(error ? "invalid" : "ready");
        return;
      }
      const { data } = await getBrowserClient().auth.getSession();
      if (!cancelled) setState(data.session ? "ready" : "invalid");
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export function ResetPasswordForm() {
  const session = useSessionFromFragment();
  const [state, action, pending] = React.useActionState(updatePassword, {});
  if (session === "invalid") {
    return (
      <p className="text-[13px] text-muted-foreground">
        This reset link is invalid or has expired.{" "}
        <Link href="/forgot-password" className="font-medium text-foreground underline-offset-4 hover:underline">
          Request a new one
        </Link>
        .
      </p>
    );
  }
  return (
    <form action={action} className="grid gap-4">
      <Field label="New password" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus />
      <Field label="Confirm password" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      <Status state={state} />
      <Button type="submit" disabled={pending || session !== "ready"} className="h-10">
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
