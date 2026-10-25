import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LEGAL, LEGAL_LINKS, legalPlaceholders } from "@/lib/legal";
import { isPublicPath } from "@/lib/public-paths";

describe("legal pages", () => {
  it("exist and are reachable signed out", () => {
    for (const { href } of LEGAL_LINKS) {
      expect(existsSync(path.join("src/app/(legal)", href, "page.tsx")), href).toBe(true);
      expect(isPublicPath(href), href).toBe(true);
    }
  });

  it("find every unfilled [placeholder] (the release gate)", () => {
    const missing = legalPlaceholders(LEGAL);
    // A fresh app must fill these before launch; `npm run legal:check` lists them.
    for (const key of ["operator", "address", "contactEmail", "jurisdiction", "regulator", "effectiveDate"]) {
      if (/\[/.test(String(LEGAL[key as keyof typeof LEGAL]))) expect(missing).toContain(key);
    }
    expect(legalPlaceholders({ operator: "Acme Ltd", processors: [{ name: "Supabase", location: "[region]" }] })).toEqual(["processors[0].location"]);
    expect(legalPlaceholders({ operator: "Acme Ltd", minimumAge: 18, processors: [{ name: "Supabase", location: "EU" }] })).toEqual([]);
  });
});
