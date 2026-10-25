import { NextResponse } from "next/server";

import { firstIssue, jsonError, readJson } from "@/lib/api";
import { APP_CONFIG, APP_TIMEZONE, SELF_SERVE } from "@/lib/app-config";
import { ACTIVE_ORG_COOKIE, ACTIVE_ORG_COOKIE_OPTIONS, apiSignedIn } from "@/lib/current-user";
import { logEvent } from "@/lib/log";
import { workspaceSchema } from "@/lib/validation";

/**
 * POST /api/workspaces { name } — SaaS tenancy only (404 otherwise). Any signed-in person with a
 * confirmed email creates a workspace and becomes its admin; it becomes their active workspace.
 * create_organization() (supabase/migrations/0003_workspaces.sql) enforces the same rules in SQL.
 */
export async function POST(request: Request) {
  if (!SELF_SERVE) return jsonError(404, "Not found.");
  const { user, supabase, response } = await apiSignedIn();
  if (!user) return response;
  const parsed = workspaceSchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return jsonError(400, firstIssue(parsed.error));

  const { data, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_timezone: APP_TIMEZONE,
    p_currency: APP_CONFIG.currency,
  });
  if (error || typeof data !== "string") {
    if (error?.code === "42501") return jsonError(403, "Confirm your email address first, then try again.");
    // check_violation carries a sentence written for people (name length, workspace limit).
    if (error?.code === "23514") return jsonError(409, error.message);
    logEvent("error", "workspace.create_failed", { code: error?.code ?? "no_id" });
    return jsonError(500, "Couldn't create the workspace. Try again.");
  }
  logEvent("info", "workspace.created", { organization_id: data });
  const res = NextResponse.json({ data: { id: data, name: parsed.data.name } }, { status: 201 });
  res.cookies.set(ACTIVE_ORG_COOKIE, data, ACTIVE_ORG_COOKIE_OPTIONS);
  return res;
}
