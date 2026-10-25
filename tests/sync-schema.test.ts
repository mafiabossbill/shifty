import { describe, expect, it } from "vitest";

import { SHIFT_RPC, SHIFT_TABLES } from "@/lib/data/shifts";

import { loadMigrations } from "../scripts/migrations";

/*
 * The sync repository names its tables and functions through constants (src/lib/data/shifts.ts), which
 * tests/schema-references.test.ts can't see. This checks them against the SHIFTY schema (migrations
 * 0100–0199, database-engineer) as soon as that range exists; until then it is skipped, not passed.
 */
const migrations = loadMigrations();
const shifty = migrations.filter((m) => Number(m.version) >= 100 && Number(m.version) <= 199);
const sql = migrations.map((m) => m.body).join("\n");

describe.skipIf(shifty.length === 0)("sync schema references", () => {
  it("every table the sync repository uses is created by a migration", () => {
    const tables = new Set([...sql.matchAll(/create table (?:if not exists )?(?:public\.)?(\w+)/gi)].map((m) => m[1]));
    expect(Object.values(SHIFT_TABLES).filter((t) => !tables.has(t))).toEqual([]);
  });

  it("every function the sync repository calls is created by a migration", () => {
    const functions = new Set([...sql.matchAll(/create (?:or replace )?function (?:public\.)?(\w+)\s*\(/gi)].map((m) => m[1]));
    expect(Object.values(SHIFT_RPC).filter((f) => !functions.has(f))).toEqual([]);
  });
});
