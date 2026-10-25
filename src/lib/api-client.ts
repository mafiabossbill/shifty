import type { DeletionImpact } from "@/lib/data/account";
import type { Invite, TeamMember } from "@/lib/data/team";
import type { Role } from "@/lib/permissions";

/** A failed API call; `message` is the server's human sentence. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const OFFLINE_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(OFFLINE_MESSAGE, 0);
  }
  const body = (await response.json().catch(() => null)) as { data?: T; error?: string } | null;
  if (!response.ok) throw new ApiError(body?.error ?? "Something went wrong. Try again.", response.status);
  return body?.data as T;
}

/** The browser's only way to the API: typed, one error shape, no ad-hoc fetch calls. */
export const api = {
  listTeam: () => request<{ members: TeamMember[]; invites: Invite[] }>("/api/team", { cache: "no-store" }),
  invite: (email: string, role: Role) => request<Invite>("/api/team/invites", { method: "POST", body: JSON.stringify({ email, role }) }),
  revokeInvite: (id: string) => request<{ id: string }>(`/api/team/invites/${id}`, { method: "DELETE" }),
  updateMember: (profileId: string, patch: { role?: Role; active?: boolean }) =>
    request<TeamMember>(`/api/team/members/${profileId}`, { method: "PATCH", body: JSON.stringify(patch) }),
  switchWorkspace: (organizationId: string) =>
    request<{ id: string; name: string }>("/api/session/organization", { method: "POST", body: JSON.stringify({ organization_id: organizationId }) }),
  accountDeletionImpact: () => request<DeletionImpact[]>("/api/account", { cache: "no-store" }),
  deleteAccount: (confirmEmail: string) =>
    request<{ deleted: true }>("/api/account", { method: "DELETE", body: JSON.stringify({ confirm_email: confirmEmail }) }),
  createWorkspace: (name: string) => request<{ id: string; name: string }>("/api/workspaces", { method: "POST", body: JSON.stringify({ name }) }),
};
