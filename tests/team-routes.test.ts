import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Session } from "@/lib/current-user";
import { InMemoryTeamRepository, type TeamMember } from "@/lib/data/team";
import type { Role } from "@/lib/permissions";

const sessionMock = vi.hoisted(() => ({ current: null as null | { session?: unknown; response?: Response } }));
vi.mock("@/lib/current-user", () => ({ apiSession: async () => sessionMock.current }));

const { GET } = await import("@/app/api/team/route");
const { POST } = await import("@/app/api/team/invites/route");
const { PATCH } = await import("@/app/api/team/members/[id]/route");

const ADMIN: TeamMember = { profile_id: "admin-1", full_name: "Asha Admin", email: "asha@example.test", role: "admin", deactivated_at: null, joined_at: "2026-01-01T00:00:00Z" };
const MEMBER: TeamMember = { profile_id: "member-1", full_name: "Musa Member", email: "musa@example.test", role: "member", deactivated_at: null, joined_at: "2026-01-02T00:00:00Z" };

function signInAs(role: Role) {
  const team = new InMemoryTeamRepository([ADMIN, MEMBER]);
  const session = {
    user: { id: role === "admin" ? ADMIN.profile_id : MEMBER.profile_id, email: "x@example.test", name: "X", role },
    organization: { id: "org", name: "Org", timezone: "UTC", currency: "USD" },
    organizations: [{ id: "org", name: "Org", role }],
    supabase: {} as Session["supabase"],
    team,
  } satisfies Session;
  sessionMock.current = { session };
  return team;
}

const post = (body: unknown) => new Request("http://test", { method: "POST", body: JSON.stringify(body) });
const patch = (body: unknown) => new Request("http://test", { method: "PATCH", body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("team routes", () => {
  beforeEach(() => {
    sessionMock.current = null;
  });

  it("are admin-only", async () => {
    signInAs("member");
    expect((await GET()).status).toBe(403);
    expect((await POST(post({ email: "new@example.test" }))).status).toBe(403);
    expect((await PATCH(patch({ active: false }), ctx(ADMIN.profile_id))).status).toBe(403);
  });

  it("records an invite with a normalized email and refuses a duplicate", async () => {
    signInAs("admin");
    const first = await POST(post({ email: "  New.Person@Example.test ", role: "manager" }));
    expect(first.status).toBe(201);
    expect((await first.json()).data).toMatchObject({ email: "new.person@example.test", role: "manager" });
    expect((await POST(post({ email: "new.person@example.test" }))).status).toBe(409);
    expect((await POST(post({ email: "not-an-email" }))).status).toBe(400);
  });

  it("deactivates a member but never the last active admin", async () => {
    signInAs("admin");
    const off = await PATCH(patch({ active: false }), ctx(MEMBER.profile_id));
    expect(off.status).toBe(200);
    expect((await off.json()).data.deactivated_at).not.toBeNull();
    const lastAdmin = await PATCH(patch({ role: "member" }), ctx(ADMIN.profile_id));
    expect(lastAdmin.status).toBe(409);
    expect(await lastAdmin.json()).toEqual({ error: "An organization needs at least one active admin." });
  });

  it("rejects unknown fields", async () => {
    signInAs("admin");
    const res = await PATCH(patch({ organization_id: "x" }), ctx(MEMBER.profile_id));
    expect(res.status).toBe(400);
  });
});
