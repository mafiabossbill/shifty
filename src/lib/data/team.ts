import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { RepoResult } from "@/lib/api";
import type { Role } from "@/lib/permissions";

export interface TeamMember {
  profile_id: string;
  full_name: string;
  /** Null unless the viewer may manage the team. */
  email: string | null;
  role: Role;
  deactivated_at: string | null;
  joined_at: string;
}

export interface Invite {
  id: string;
  email: string;
  role: Role;
  created_at: string;
}

/** Team management behind one interface (Supabase under RLS in the app, in-memory in tests). */
export interface TeamRepository {
  members(): Promise<TeamMember[]>;
  invites(): Promise<Invite[]>;
  invite(email: string, role: Role): Promise<RepoResult<Invite>>;
  revokeInvite(id: string): Promise<RepoResult<{ id: string }>>;
  updateMember(profileId: string, patch: { role?: Role; active?: boolean }): Promise<RepoResult<TeamMember>>;
}

function toFailure(error: PostgrestError): RepoResult<never> {
  if (error.code === "23505") return { ok: false, error: "conflict", message: "That address already has a pending invite." };
  if (error.code === "23514") return { ok: false, error: "conflict", message: error.message };
  if (error.code === "42501") return { ok: false, error: "forbidden", message: "You can't manage the team." };
  throw new Error(`Database error ${error.code}: ${error.message}`);
}

export class SupabaseTeamRepository implements TeamRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly organizationId: string,
    private readonly actorId: string,
  ) {}

  async members(): Promise<TeamMember[]> {
    const { data, error } = await this.supabase.rpc("team_directory", { org: this.organizationId });
    if (error) throw new Error(`Couldn't load the team: ${error.message}`);
    return data as TeamMember[];
  }

  async invites(): Promise<Invite[]> {
    const { data, error } = await this.supabase
      .from("organization_invites")
      .select("id, email, role, created_at")
      .eq("organization_id", this.organizationId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Couldn't load invites: ${error.message}`);
    return data as Invite[];
  }

  async invite(email: string, role: Role): Promise<RepoResult<Invite>> {
    const { data, error } = await this.supabase
      .from("organization_invites")
      .insert({ organization_id: this.organizationId, email, role, invited_by: this.actorId })
      .select("id, email, role, created_at")
      .single();
    if (error) return toFailure(error);
    return { ok: true, value: data as Invite };
  }

  async revokeInvite(id: string): Promise<RepoResult<{ id: string }>> {
    const { data, error } = await this.supabase
      .from("organization_invites")
      .delete()
      .eq("organization_id", this.organizationId)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) return toFailure(error);
    if (!data) return { ok: false, error: "not_found", message: "Invite not found." };
    return { ok: true, value: { id } };
  }

  async updateMember(profileId: string, patch: { role?: Role; active?: boolean }): Promise<RepoResult<TeamMember>> {
    const row: Record<string, unknown> = {};
    if (patch.role) row.role = patch.role;
    if (patch.active !== undefined) row.deactivated_at = patch.active ? null : new Date().toISOString();
    const { data, error } = await this.supabase
      .from("organization_members")
      .update(row)
      .eq("organization_id", this.organizationId)
      .eq("profile_id", profileId)
      .select("profile_id")
      .maybeSingle();
    if (error) return toFailure(error);
    if (!data) return { ok: false, error: "not_found", message: "Member not found." };
    const member = (await this.members()).find((m) => m.profile_id === profileId);
    if (!member) return { ok: false, error: "not_found", message: "Member not found." };
    return { ok: true, value: member };
  }
}

/** Test double. Mirrors the database rules that matter to callers: one pending invite per email, last admin stays. */
export class InMemoryTeamRepository implements TeamRepository {
  private list: TeamMember[] = [];
  private pending: Invite[] = [];

  constructor(members: TeamMember[] = []) {
    this.list = members;
  }

  async members() {
    return this.list;
  }

  async invites() {
    return this.pending;
  }

  async invite(email: string, role: Role): Promise<RepoResult<Invite>> {
    if (this.pending.some((i) => i.email === email)) return { ok: false, error: "conflict", message: "That address already has a pending invite." };
    const invite = { id: `inv-${this.pending.length + 1}`, email, role, created_at: new Date(0).toISOString() };
    this.pending.push(invite);
    return { ok: true, value: invite };
  }

  async revokeInvite(id: string): Promise<RepoResult<{ id: string }>> {
    const before = this.pending.length;
    this.pending = this.pending.filter((i) => i.id !== id);
    return before === this.pending.length ? { ok: false, error: "not_found", message: "Invite not found." } : { ok: true, value: { id } };
  }

  async updateMember(profileId: string, patch: { role?: Role; active?: boolean }): Promise<RepoResult<TeamMember>> {
    const member = this.list.find((m) => m.profile_id === profileId);
    if (!member) return { ok: false, error: "not_found", message: "Member not found." };
    const next: TeamMember = {
      ...member,
      role: patch.role ?? member.role,
      deactivated_at: patch.active === undefined ? member.deactivated_at : patch.active ? null : new Date(0).toISOString(),
    };
    const admins = this.list.filter((m) => m.role === "admin" && !m.deactivated_at && m.profile_id !== profileId);
    if (member.role === "admin" && (next.role !== "admin" || next.deactivated_at) && admins.length === 0) {
      return { ok: false, error: "conflict", message: "An organization needs at least one active admin." };
    }
    this.list = this.list.map((m) => (m.profile_id === profileId ? next : m));
    return { ok: true, value: next };
  }
}
