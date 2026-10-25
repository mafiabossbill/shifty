import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/lib/public-paths";
import { safeNextPath } from "@/lib/utils";

describe("public paths", () => {
  it("serves the device-mode tracking shell, auth and legal pages without a session", () => {
    for (const path of [
      "/",
      "/sessions",
      "/sessions/new",
      "/sessions/trash",
      "/sessions/8d6f1c2e-0000-4000-8000-000000000000",
      "/insights",
      "/companion",
      "/settings",
      "/settings/privacy",
      "/settings/data",
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/auth/callback",
      "/privacy",
      "/terms",
      "/cookies",
      "/data-deletion",
    ]) {
      expect(isPublicPath(path), path).toBe(true);
    }
  });

  it("keeps account-only pages behind a session, and matches whole segments only", () => {
    for (const path of ["/dashboard", "/no-access", "/onboarding", "/loginx", "/privacy-admin", "/sessionsx", "/settingsx", "/insights-old"]) {
      expect(isPublicPath(path), path).toBe(false);
    }
  });

  it("only follows same-site ?next= paths", () => {
    expect(safeNextPath("/projects?status=active")).toBe("/projects?status=active");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("/\t/evil.example")).toBe("/");
    expect(safeNextPath("/\n/evil.example")).toBe("/");
    // Still encoded, it's a harmless same-origin path segment.
    expect(safeNextPath("/%09/evil.example")).toBe("/%09/evil.example");
    expect(safeNextPath("/sessions/view?id=1#x")).toBe("/sessions/view?id=1#x");
    expect(safeNextPath(null)).toBe("/");
  });
});
