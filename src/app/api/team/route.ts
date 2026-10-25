import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { apiSession } from "@/lib/current-user";
import { can } from "@/lib/permissions";

/** GET /api/team → { data: { members, invites } } (member:manage). */
export async function GET() {
  const { session, response } = await apiSession();
  if (!session) return response;
  if (!can(session.user, "member:manage")) return jsonError(403, "Only admins can manage the team.");
  const [members, invites] = await Promise.all([session.team.members(), session.team.invites()]);
  return NextResponse.json({ data: { members, invites } });
}
