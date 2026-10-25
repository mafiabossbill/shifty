import { describe, expect, it } from "vitest";

import { pickMembership } from "@/lib/current-user";

describe("active workspace", () => {
  const rows = [{ organization_id: "a" }, { organization_id: "b" }];

  it("uses the cookie's workspace only while the person is a member of it", () => {
    expect(pickMembership(rows, "b")?.organization_id).toBe("b");
    expect(pickMembership(rows, "removed")?.organization_id).toBe("a");
    expect(pickMembership(rows, undefined)?.organization_id).toBe("a");
    expect(pickMembership([], "a")).toBeNull();
  });
});
