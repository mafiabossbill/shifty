import { NextResponse } from "next/server";

import { firstIssue, jsonError, readJson, repoErrorStatus } from "@/lib/api";
import { apiSession } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { inviteSchema } from "@/lib/validation";

/**
 * POST /api/team/invites { email, role } → 201 { data: Invite }.
 * Nothing is emailed: the person creates an account with that address (/signup) and is
 * added with this role once their email is confirmed (claim_invite()).
 */
export async function POST(request: Request) {
  const { session, response } = await apiSession();
  if (!session) return response;
  const parsed = inviteSchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return jsonError(400, firstIssue(parsed.error));
  if (!can(session.user, "member:manage")) return jsonError(403, "Only admins can invite people.");
  const result = await session.team.invite(parsed.data.email, parsed.data.role);
  if (!result.ok) return jsonError(repoErrorStatus(result.error), result.message);
  return NextResponse.json({ data: result.value }, { status: 201 });
}
