import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/lib/public-paths";
import { safeNextPath } from "@/lib/utils";

describe("public paths", () => {
  it("allows auth and legal pages signed out, nothing else", () => {
    for (const path of ["/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback", "/privacy", "/terms", "/cookies", "/data-deletion"]) {
      expect(isPublicPath(path)).toBe(true);
    }
    for (const path of ["/", "/dashboard", "/projects", "/settings", "/loginx", "/privacy-admin"]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });

  it("only follows same-site ?next= paths", () => {
    expect(safeNextPath("/projects?status=active")).toBe("/projects?status=active");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
