import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { jsonError } from "@/lib/api";
import { APP_CONFIG, APP_TIMEZONE, SELF_SERVE } from "@/lib/app-config";
import { SupabaseTeamRepository, type TeamRepository } from "@/lib/data/team";
import { isRole, type Role } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** Cookie naming the workspace a person in several organizations is working in (POST /api/session/organization). */
export const ACTIVE_ORG_COOKIE = "active_org";
export const ACTIVE_ORG_COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 } as const;

export interface Session {
  user: SessionUser;
  organization: { id: string; name: string; timezone: string; currency: string };
  /** Every active membership, for a workspace switcher (one entry for company tenancy). */
  organizations: { id: string; name: string; role: Role }[];
  supabase: SupabaseClient;
  team: TeamRepository;
}

export type SessionState =
  | { status: "anonymous" }
  | { status: "no_membership"; email: string }
  | { status: "ok"; session: Session };

interface MembershipRow {
  organization_id: string;
  role: string;
  organizations: { name: string; timezone: string | null; currency: string | null } | null;
  profiles: { full_name: string | null } | null;
}

async function loadMemberships(supabase: SupabaseClient, userId: string): Promise<MembershipRow[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(name, timezone, currency), profiles(full_name)")
    .eq("profile_id", userId)
    .is("deactivated_at", null)
    .order("created_at")
    .limit(50);
  if (error) throw new Error(`Couldn't load membership: ${error.message}`);
  return (data ?? []) as unknown as MembershipRow[];
}

/** The workspace named by the cookie if the person is still an active member of it, else their first. */
export function pickMembership<T extends { organization_id: string }>(rows: T[], preferred: string | undefined): T | null {
  return rows.find((row) => row.organization_id === preferred) ?? rows[0] ?? null;
}

/**
 * The signed-in user with their organization and role, once per request.
 * A user without a membership first claims a pending invite for their confirmed
 * email (claim_invite()), then gets one chance at the admin bootstrap
 * (claim_admin_bootstrap(): their confirmed email must equal ADMIN_EMAIL).
 * Deactivated members count as having no membership.
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  // Session data is per request: never prerender it (Cache Components).
  await connection();
  const supabase = await createClient();
  // getClaims() verifies the JWT; never trust getSession() on the server.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return { status: "anonymous" };
  const email = typeof claims.email === "string" ? claims.email : "";

  let memberships = await loadMemberships(supabase, claims.sub);
  if (memberships.length === 0) {
    const { data: invited } = await supabase.rpc("claim_invite");
    const { data: role } = invited ? { data: invited } : await supabase.rpc("claim_admin_bootstrap");
    if (role) memberships = await loadMemberships(supabase, claims.sub);
  }
  const membership = pickMembership(memberships, (await cookies()).get(ACTIVE_ORG_COOKIE)?.value);
  if (!membership || !isRole(membership.role)) return { status: "no_membership", email };

  const user: SessionUser = {
    id: claims.sub,
    email,
    name: membership.profiles?.full_name || email,
    role: membership.role,
  };
  return {
    status: "ok",
    session: {
      user,
      organization: {
        id: membership.organization_id,
        name: membership.organizations?.name ?? "",
        timezone: membership.organizations?.timezone || APP_TIMEZONE,
        currency: membership.organizations?.currency?.trim() || APP_CONFIG.currency,
      },
      organizations: memberships
        .filter((m) => isRole(m.role))
        .map((m) => ({ id: m.organization_id, name: m.organizations?.name ?? "", role: m.role as Role })),
      supabase,
      team: new SupabaseTeamRepository(supabase, membership.organization_id, claims.sub),
    },
  };
});

/** For pages: redirects to /login, or /onboarding (SaaS) / /no-access (company), instead of returning nothing. */
export async function requireSession(): Promise<Session> {
  const state = await getSessionState();
  if (state.status === "anonymous") redirect("/login");
  if (state.status === "no_membership") redirect(SELF_SERVE ? "/onboarding" : "/no-access");
  return state.session;
}

/** For route handlers: the session, or the 401/403 response to send. */
export async function apiSession(): Promise<
  { session: Session; response?: never } | { session?: never; response: Response }
> {
  const state = await getSessionState();
  if (state.status === "anonymous") return { response: jsonError(401, "Sign in to continue.") };
  if (state.status === "no_membership") {
    return { response: jsonError(403, SELF_SERVE ? "Create a workspace to continue." : "Your account isn't a member of any organization yet.") };
  }
  return { session: state.session };
}

/** For routes that only need a signed-in person, with or without a workspace (creating one). */
export async function apiSignedIn(): Promise<
  { user: { id: string; email: string }; supabase: SupabaseClient; response?: never } | { user?: never; supabase?: never; response: Response }
> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { response: jsonError(401, "Sign in to continue.") };
  return { user: { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" }, supabase };
}
