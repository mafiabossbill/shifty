import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

/**
 * Landing point for Supabase email links (confirmation, invites, magic links).
 * Handles both the PKCE `?code=` flow and `?token_hash=&type=` templates, then
 * continues to `next` with a session cookie set.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  // Device mode: no accounts here; /login explains.
  if (!supabaseConfigured()) return NextResponse.redirect(new URL("/login", request.url));
  const supabase = await createClient();

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Missing code") };

  const target = request.nextUrl.clone();
  target.search = "";
  if (error) {
    target.pathname = "/login";
    target.searchParams.set("error", "link");
  } else {
    target.pathname = next;
  }
  return NextResponse.redirect(target);
}
