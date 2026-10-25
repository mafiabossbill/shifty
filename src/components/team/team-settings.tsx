"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/ui/status-pill";
import { ApiError, api } from "@/lib/api-client";
import type { Invite, TeamMember } from "@/lib/data/team";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/permissions";

const selectClass = "h-8 rounded-md border border-input bg-transparent px-2 text-[13px] max-md:h-10 dark:bg-input/30";

function message(error: unknown) {
  return error instanceof ApiError ? error.message : "Something went wrong. Try again.";
}

/**
 * Invite people, change roles, deactivate (never delete: history keeps its authors).
 * Rows on desktop, stacked on phones; destructive actions confirm first.
 */
export function TeamSettings({ viewerId, initialMembers, initialInvites }: { viewerId: string; initialMembers: TeamMember[]; initialInvites: Invite[] }) {
  const confirm = useConfirm();
  const [members, setMembers] = React.useState(initialMembers);
  const [invites, setInvites] = React.useState(initialInvites);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("member");
  const [pending, setPending] = React.useState(false);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const created = await api.invite(email, role);
      setInvites((list) => [created, ...list]);
      setEmail("");
      toast.success("Invite recorded", { description: `${created.email} can now sign up with that address.` });
    } catch (error) {
      toast.error(message(error));
    } finally {
      setPending(false);
    }
  }

  async function update(member: TeamMember, patch: { role?: Role; active?: boolean }) {
    if (patch.active === false) {
      const ok = await confirm({
        title: `Deactivate ${member.full_name || member.email}?`,
        description: "They lose access straight away. Their history stays. You can reactivate them later.",
        confirmLabel: "Deactivate",
        destructive: true,
      });
      if (!ok) return;
    }
    try {
      const saved = await api.updateMember(member.profile_id, patch);
      setMembers((list) => list.map((m) => (m.profile_id === saved.profile_id ? saved : m)));
    } catch (error) {
      toast.error(message(error));
    }
  }

  async function revoke(item: Invite) {
    if (!(await confirm({ title: `Revoke the invite for ${item.email}?`, destructive: true, confirmLabel: "Revoke" }))) return;
    try {
      await api.revokeInvite(item.id);
      setInvites((list) => list.filter((i) => i.id !== item.id));
    } catch (error) {
      toast.error(message(error));
    }
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-6">
      <h1 className="text-base font-semibold">Team</h1>

      <form onSubmit={invite} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="invite-email">Invite by email</Label>
          <Input id="invite-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <select id="invite-role" className={selectClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Inviting…" : "Invite"}
        </Button>
        <p className="text-xs text-muted-foreground sm:col-span-3">
          Nothing is emailed by the app. Tell them to create an account at /signup with this address; they join once their email is confirmed.
        </p>
      </form>

      {invites.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Pending invites</h2>
          <ul className="divide-y rounded-lg border">
            {invites.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 p-3">
                <span className="min-w-0 flex-1 truncate">{item.email}</span>
                <span className="text-muted-foreground">{ROLE_LABELS[item.role]}</span>
                <Button size="sm" variant="ghost" onClick={() => revoke(item)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-2">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Members</h2>
        <ul className="divide-y rounded-lg border">
          {members.map((member) => (
            <li key={member.profile_id} className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {member.full_name || member.email}
                  {member.profile_id === viewerId && <span className="font-normal text-muted-foreground"> (you)</span>}
                </div>
                <div className="truncate text-muted-foreground">{member.email}</div>
              </div>
              {member.deactivated_at ? (
                <>
                  <StatusPill label="Deactivated" tone="neutral" />
                  <Button size="sm" variant="outline" onClick={() => update(member, { active: true })}>
                    Reactivate
                  </Button>
                </>
              ) : (
                <>
                  <select
                    aria-label={`Role for ${member.full_name || member.email}`}
                    className={selectClass}
                    value={member.role}
                    onChange={(e) => update(member, { role: e.target.value as Role })}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" variant="ghost" className="text-red-700" onClick={() => update(member, { active: false })}>
                    Deactivate
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
