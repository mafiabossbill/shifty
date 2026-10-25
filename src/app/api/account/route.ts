import { NextResponse } from "next/server";

import { firstIssue, jsonError, readJson } from "@/lib/api";
import { ACTIVE_ORG_COOKIE, apiSignedIn } from "@/lib/current-user";
import { deletionImpact } from "@/lib/data/account";
import { refuseUnsafeRequest } from "@/app/api/sync/_lib/pipeline";
import { logEvent } from "@/lib/log";
import { supabaseConfigured } from "@/lib/supabase/env";
import { accountDeleteSchema } from "@/lib/validation";

const NO_ACCOUNTS = "Accounts aren't set up on this deployment. Your data lives on this device: clear it from Settings → Data.";

/** GET /api/account — what deleting the account would do, per workspace. */
export async function GET() {
  if (!supabaseConfigured()) return jsonError(503, NO_ACCOUNTS);
  const { user, supabase, response } = await apiSignedIn();
  if (!user) return response;
  return NextResponse.json({ data: await deletionImpact(supabase) });
}

/**
 * DELETE /api/account { confirm_email } — deletes the signed-in person's account (delete_own_account():
 * email must match; refused while they're the last admin of a workspace others still use). Signs out.
 */
export async function DELETE(request: Request) {
  const refused = refuseUnsafeRequest(request);
  if (refused) return refused;
  if (!supabaseConfigured()) return jsonError(503, NO_ACCOUNTS);
  const { user, supabase, response } = await apiSignedIn();
  if (!user) return response;
  const parsed = accountDeleteSchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return jsonError(400, firstIssue(parsed.error));

  const { error } = await supabase.rpc("delete_own_account", { p_confirm_email: parsed.data.confirm_email });
  if (error) {
    // check_violation carries a sentence written for people (wrong email, last admin).
    if (error.code === "23514") return jsonError(409, error.message);
    logEvent("error", "account.delete_failed", { code: error.code });
    return jsonError(500, "Couldn't delete your account. Try again or contact us.");
  }
  logEvent("info", "account.deleted", { profile_id: user.id });
  await supabase.auth.signOut();
  const res = NextResponse.json({ data: { deleted: true } });
  res.cookies.delete(ACTIVE_ORG_COOKIE);
  return res;
}
