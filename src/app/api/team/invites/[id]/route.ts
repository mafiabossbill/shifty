import { NextResponse } from "next/server";

import { jsonError, repoErrorStatus } from "@/lib/api";
import { apiSession } from "@/lib/current-user";
import { can } from "@/lib/permissions";

/** DELETE /api/team/invites/:id — revoke a pending invite. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/team/invites/[id]">) {
  const { session, response } = await apiSession();
  if (!session) return response;
  if (!can(session.user, "member:manage")) return jsonError(403, "Only admins can revoke invites.");
  const result = await session.team.revokeInvite((await ctx.params).id);
  if (!result.ok) return jsonError(repoErrorStatus(result.error), result.message);
  return NextResponse.json({ data: result.value });
}
