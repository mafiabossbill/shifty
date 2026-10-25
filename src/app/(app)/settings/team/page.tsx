import type { Metadata } from "next";
import { connection } from "next/server";

import { TeamSettings } from "@/components/team/team-settings";
import { requireSession } from "@/lib/current-user";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  await connection();
  const { user, team } = await requireSession();
  if (!can(user, "member:manage")) {
    return <p className="p-6 text-muted-foreground">Only admins can manage the team.</p>;
  }
  const [members, invites] = await Promise.all([team.members(), team.invites()]);
  return <TeamSettings viewerId={user.id} initialMembers={members} initialInvites={invites} />;
}
