import { NextResponse } from "next/server";
import { z } from "zod";

import { firstIssue, jsonError, readJson } from "@/lib/api";
import { ACTIVE_ORG_COOKIE, ACTIVE_ORG_COOKIE_OPTIONS, apiSession } from "@/lib/current-user";

const bodySchema = z.object({ organization_id: z.uuid({ error: "Choose a workspace." }) });

/**
 * POST /api/session/organization { organization_id } — switch the active workspace for people
 * who belong to several organizations. Membership is checked here and again on every request
 * (getSessionState ignores a cookie naming a workspace you're no longer in); RLS still scopes data.
 */
export async function POST(request: Request) {
  const { session, response } = await apiSession();
  if (!session) return response;
  const parsed = bodySchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return jsonError(400, firstIssue(parsed.error));
  const target = session.organizations.find((org) => org.id === parsed.data.organization_id);
  if (!target) return jsonError(403, "You're not a member of that workspace.");
  const res = NextResponse.json({ data: target });
  res.cookies.set(ACTIVE_ORG_COOKIE, target.id, ACTIVE_ORG_COOKIE_OPTIONS);
  return res;
}
