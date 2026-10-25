import type { SupabaseClient } from "@supabase/supabase-js";

import { SupabaseShiftRepository, type ShiftRepository } from "./shifts";

/*
 * The signed-in person's own data: export (access + portability) and deletion (erasure).
 * Reads run as the person, so RLS limits the export to what they may see.
 */

export interface DeletionImpact {
  organization_id: string;
  organization_name: string;
  /** deleted: they're its only member · blocked: last admin with others left · kept: only their membership goes */
  outcome: "deleted" | "blocked" | "kept";
}

/** SHIFTY tracking data: every session (trash included, with its location fixes: it's the person's own data),
 * the profile document (settings, companion, projects, places, activities, reward ledger, achievements) and
 * how many events the server has committed. */
export async function exportShiftData(repo: ShiftRepository): Promise<Record<string, unknown>> {
  const [sessions, profile, events] = await Promise.all([repo.loadSessions(), repo.loadProfile(), repo.countEvents()]);
  return {
    note: "Instants are UTC epoch milliseconds; each session keeps the IANA timezone its days are reported in.",
    sessions,
    ...profile,
    events_committed: events,
  };
}

/** Everything the app holds about the person, as one JSON document. */
export async function exportAccountData(supabase: SupabaseClient, userId: string): Promise<Record<string, unknown>> {
  const [{ data: auth }, profile, memberships, shifty] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("full_name, created_at, updated_at").eq("id", userId).maybeSingle(),
    supabase
      .from("organization_members")
      .select("role, deactivated_at, created_at, organizations(name)")
      .eq("profile_id", userId)
      .order("created_at"),
    exportShiftData(new SupabaseShiftRepository(supabase, userId, null)),
  ]);
  const data: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: {
      id: userId,
      email: auth.user?.email ?? null,
      created_at: auth.user?.created_at ?? null,
      last_sign_in_at: auth.user?.last_sign_in_at ?? null,
      // Sign-up details, including which terms version was accepted and when.
      metadata: auth.user?.user_metadata ?? {},
    },
    profile: profile.data,
    workspaces: memberships.data ?? [],
    shifty,
  };
  // Add each entity's rows the person created or is named on.
  return data;
}

/** What deleting the account would do to each workspace (account_deletion_preview()). */
export async function deletionImpact(supabase: SupabaseClient): Promise<DeletionImpact[]> {
  const { data, error } = await supabase.rpc("account_deletion_preview");
  if (error) throw new Error(`Couldn't check your workspaces: ${error.message}`);
  return (data ?? []) as DeletionImpact[];
}
