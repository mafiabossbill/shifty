"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { CircleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestPasswordReset, signIn, signUp, updatePassword, type FormState } from "@/lib/auth-actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-rules";
import { getBrowserClient } from "@/lib/supabase/client";

/*
 * Sign-in, sign-up and password forms. One column, the label above each field (Field), the answer
 * from the server at the top of the form as an icon and a sentence, one solid button. Links to the
 * neighbouring pages are underlined text under the form.
 */

const linkClass = "underline decoration-control underline-offset-4 hover:decoration-foreground";
/** Under a form: the one solid button first, then links. Phones: stacked, the button full width. */
const actionsClass = "flex flex-wrap items-center gap-x-4 gap-y-3 max-md:flex-col max-md:items-stretch";
const besideButtonClass = `${linkClass} max-md:flex max-md:min-h-11 max-md:items-center`;

/** What the server said about the whole form: a problem to fix (red, with an icon) or a confirmation. */
function Status({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="flex items-start gap-1.5 font-semibold text-red-700">
        <CircleAlertIcon className="mt-1 size-3.5 shrink-0" aria-hidden />
        {state.error}
      </p>
    );
  }
  if (state.message) return <p role="status">{state.message}</p>;
  return null;
}

const LINK_ERRORS: Record<string, string> = { link: "That link is invalid or has expired. Request a new one." };

/** `initialState` is for the design gallery only: it shows the form as the server would have answered it. */
export function LoginForm({ initialState }: { initialState?: FormState }) {
  const params = useSearchParams();
  const [state, action, pending] = React.useActionState(signIn, initialState ?? { error: LINK_ERRORS[params.get("error") ?? ""] });
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      <Status state={state} />
      <Field label="Email">
        <Input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} defaultValue={state.email} required autoFocus />
      </Field>
      <Field label="Password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className={actionsClass}>
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <Link href="/forgot-password" className={besideButtonClass}>
          Forgot password?
        </Link>
      </div>
      <p className="text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className={`${linkClass} text-foreground`}>
          Create account
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = React.useActionState(signUp, {});
  return (
    <form action={action} className="grid gap-4">
      <Status state={state} />
      <Field label="Full name">
        <Input id="full_name" name="full_name" autoComplete="name" required />
      </Field>
      <Field label="Email">
        <Input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} defaultValue={state.email} required />
      </Field>
      <Field label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
      </Field>
      <p className="text-caption text-muted-foreground">
        By creating an account you agree to the{" "}
        <Link href="/terms" className={linkClass}>
          Terms of service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className={linkClass}>
          Privacy policy
        </Link>
        .
      </p>
      <div className={actionsClass}>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
        <Link href="/login" className={besideButtonClass}>
          Already have an account? Sign in
        </Link>
      </div>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = React.useActionState(requestPasswordReset, {});
  return (
    <form action={action} className="grid gap-4">
      <Status state={state} />
      <Field label="Email">
        <Input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} defaultValue={state.email} required autoFocus />
      </Field>
      <div className={actionsClass}>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
        <Link href="/login" className={besideButtonClass}>
          Back to sign in
        </Link>
      </div>
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
      <p>
        This reset link is invalid or has expired.{" "}
        <Link href="/forgot-password" className={linkClass}>
          Request a new one
        </Link>
        .
      </p>
    );
  }
  return (
    <form action={action} className="grid gap-4">
      <Status state={state} />
      <Field label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required autoFocus />
      </Field>
      <Field label="Confirm password">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
      </Field>
      <div className={actionsClass}>
        <Button type="submit" disabled={pending || session !== "ready"}>
          {pending ? "Saving…" : "Save password"}
        </Button>
      </div>
    </form>
  );
}
