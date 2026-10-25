import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadMigrations } from "../scripts/migrations";

describe("migrations", () => {
  const migrations = loadMigrations();

  it("have unique, well-formed versions", () => {
    expect(migrations.length).toBeGreaterThan(0);
    expect(new Set(migrations.map((m) => m.version)).size).toBe(migrations.length);
  });

  it("refuse a duplicate version instead of silently skipping it", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "migrations-"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "0080_one.sql"), "select 1;");
    writeFileSync(path.join(dir, "0080_two.sql"), "select 2;");
    expect(() => loadMigrations(dir)).toThrow(/Duplicate migration version 0080/);
  });

  it("enable row-level security on every table they create", () => {
    const all = migrations.map((m) => m.body).join("\n");
    const tables = [...all.matchAll(/create table (?:if not exists )?(?!private\.)(\w+)\s*\(/gi)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      expect(all, `${table} has no RLS`).toMatch(new RegExp(`alter table ${table}\\s+enable row level security`, "i"));
    }
  });

  it("give every org-scoped table an organization_id foreign key and timestamps", () => {
    const all = migrations.map((m) => m.body).join("\n");
    for (const [, table, body] of all.matchAll(/create table (?!private\.)(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
      if (!/organization_id/.test(body)) continue;
      expect(body, `${table}.organization_id`).toMatch(/organization_id\s+uuid not null references organizations/);
      expect(body, `${table}.created_at`).toMatch(/created_at\s+timestamptz not null default now\(\)/);
    }
  });
});
