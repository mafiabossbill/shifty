import { describe, expect, it } from "vitest";

import { CAPABILITIES, ROLES, ROLE_CAPABILITIES, can } from "@/lib/permissions";

import { loadMigrations } from "../scripts/migrations";

/** Parses the LAST private.role_capabilities() definition across migrations: role → capability list. */
function sqlCapabilities(): Record<string, string[]> {
  const definitions = loadMigrations()
    .flatMap((m) => [...m.body.matchAll(/function private\.role_capabilities[\s\S]*?\$\$([\s\S]*?)\$\$/g)].map((x) => x[1]));
  const body = definitions.at(-1) ?? "";
  const map: Record<string, string[]> = {};
  for (const match of body.matchAll(/when '(\w+)' then array\[([\s\S]*?)\]/g)) {
    map[match[1]] = [...match[2].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  }
  return map;
}

describe("capability map", () => {
  it("only grants known capabilities", () => {
    for (const role of ROLES) for (const cap of ROLE_CAPABILITIES[role]) expect(CAPABILITIES).toContain(cap);
  });

  it("is mirrored exactly by has_capability() in Postgres", () => {
    const sql = sqlCapabilities();
    expect(Object.keys(sql).sort()).toEqual([...ROLES].sort());
    for (const role of ROLES) expect([...sql[role]].sort()).toEqual([...ROLE_CAPABILITIES[role]].sort());
  });

  it("keeps team management for admins", () => {
    expect(can({ role: "admin" }, "member:manage")).toBe(true);
    for (const role of ["manager", "member", "viewer"] as const) expect(can({ role }, "member:manage")).toBe(false);
  });

  it("lets admins and members track their own shifts, nobody else", () => {
    for (const role of ["admin", "member"] as const) expect(can({ role }, "shift:track")).toBe(true);
    for (const role of ["manager", "viewer"] as const) expect(can({ role }, "shift:track")).toBe(false);
  });

});
