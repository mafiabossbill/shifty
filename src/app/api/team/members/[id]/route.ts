import { NextResponse } from "next/server";

import { firstIssue, jsonError, readJson, repoErrorStatus } from "@/lib/api";
import { apiSession } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { memberPatchSchema } from "@/lib/validation";

/**
 * PATCH /api/team/members/:profileId { role?, active? } — change role or (de)activate.
 * Deactivated members keep their history but lose all access (every RLS helper ignores them).
 * The database refuses to remove the last active admin (409).
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/team/members/[id]">) {
  const { session, response } = await apiSession();
  if (!session) return response;
  const parsed = memberPatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(400, firstIssue(parsed.error));
  if (!can(session.user, "member:manage")) return jsonError(403, "Only admins can change members.");
  const result = await session.team.updateMember((await ctx.params).id, parsed.data);
  if (!result.ok) return jsonError(repoErrorStatus(result.error), result.message);
  return NextResponse.json({ data: result.value });
}
