import type { SupabaseClient } from "@supabase/supabase-js";

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

/** Everything the app holds about the person, as one JSON document. */
export async function exportAccountData(supabase: SupabaseClient, userId: string): Promise<Record<string, unknown>> {
  const [{ data: auth }, profile, memberships] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("full_name, created_at, updated_at").eq("id", userId).maybeSingle(),
    supabase
      .from("organization_members")
      .select("role, deactivated_at, created_at, organizations(name)")
      .eq("profile_id", userId)
      .order("created_at"),
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
