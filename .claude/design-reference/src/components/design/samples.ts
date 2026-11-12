import type { Project } from "@/lib/data/projects"; // @example
import type { Invite, TeamMember } from "@/lib/data/team";

/*
 * Sample data for the design gallery. It is written to stress a screen, not to flatter it:
 * the longest and the shortest value a field can hold, every status, missing values.
 */

// @example-start
const project = (id: number, name: string, status: Project["status"], due_date: string | null, description: string | null = null): Project => ({
  id: `sample-${id}`,
  organization_id: "sample-workspace",
  name,
  status,
  owner_id: id % 2 ? "sample-user" : null,
  due_date,
  description,
  created_by: "sample-user",
  client_id: null,
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-20T08:00:00Z",
});

export const SAMPLE_PROJECTS: Project[] = [
  project(1, "Website relaunch", "active", "2026-11-28", "New pages, new checkout."),
  project(2, "Warehouse stock count for the Dar es Salaam, Arusha and Mwanza depots before the year-end audit", "on_hold", "2026-12-15"),
  project(3, "Payroll", "done", "2026-10-31"),
  project(4, "Customer onboarding checklist", "planned", null),
  project(5, "Supplier contracts", "active", "2026-11-05"),
  project(6, "Q1 plan", "planned", "2027-01-10"),
];

export const SAMPLE_PROJECT_VIEWER = { id: "sample-user", canCreate: true, canUpdateAny: true, canUpdateOwn: true, canDelete: true };
// @example-end

export const SAMPLE_MEMBERS: TeamMember[] = [
  { profile_id: "sample-user", full_name: "Amina Hassan", email: "amina@example.com", role: "admin", deactivated_at: null, joined_at: "2026-01-12T08:00:00Z" },
  { profile_id: "sample-2", full_name: "Baraka Mwakyusa-Ndunguru", email: "baraka.mwakyusa-ndunguru@example.com", role: "manager", deactivated_at: null, joined_at: "2026-03-02T08:00:00Z" },
  { profile_id: "sample-3", full_name: "Li Wei", email: "li@example.com", role: "member", deactivated_at: null, joined_at: "2026-06-18T08:00:00Z" },
  { profile_id: "sample-4", full_name: "Neema Joseph", email: "neema@example.com", role: "viewer", deactivated_at: "2026-09-01T08:00:00Z", joined_at: "2026-02-20T08:00:00Z" },
];

export const SAMPLE_INVITES: Invite[] = [{ id: "sample-invite", email: "new.person@example.com", role: "member", created_at: "2026-11-01T08:00:00Z" }];
