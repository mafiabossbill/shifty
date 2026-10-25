"use server";

import { createClient as createAnonClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { MIN_PASSWORD_LENGTH } from "@/lib/auth-rules";
import { TERMS_VERSION } from "@/lib/legal";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

export interface FormState {
  error?: string;
  message?: string;
  /** Echoed back so React's post-action form reset keeps what was typed. */
  email?: string;
}

/** NEXT_PUBLIC_SITE_URL once the domain is final; otherwise the request origin. */
async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error: error.code === "email_not_confirmed" ? "Confirm your email address before signing in." : "Email or password is incorrect.",
      email,
    };
  }
  redirect(safeNextPath(formData.get("next")));
}

/** Self-service sign-up. Access comes from an invite, the admin bootstrap or (SaaS) creating a workspace. */
export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim().slice(0, 120);
  if (!email || !password) return { error: "Enter your email and a password.", email };
  if (password.length < MIN_PASSWORD_LENGTH) return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`, email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Consent record: which terms and privacy policy version they accepted, and when (exported with their data).
      data: { ...(fullName ? { full_name: fullName } : {}), terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() },
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/`,
    },
  });
  if (error) {
    if (error.status === 429) return { error: "Too many attempts. Try again in a few minutes.", email };
    return { error: error.message, email };
  }
  if (data.session) redirect("/");
  return { message: "Check your inbox for a confirmation link.", email };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address.", email };

  // Implicit flow: the email link carries the session in its #fragment, so it opens in
  // any browser or on a phone. PKCE only works in the browser that asked (it holds the verifier).
  const { url, anonKey } = supabaseEnv();
  const supabase = createAnonClient(url, anonKey, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await siteOrigin()}/reset-password` });
  // Same answer whether or not the account exists; only surface rate limiting.
  if (error?.status === 429) return { error: "Too many reset emails. Try again in a few minutes.", email };
  return { message: "If an account exists for that email, a reset link is on its way.", email };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  if (password !== confirm) return { error: "The passwords don't match." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/");
}
