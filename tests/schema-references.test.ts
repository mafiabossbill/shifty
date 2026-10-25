import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { APP_CONFIG } from "@/lib/app-config";

import { loadMigrations } from "../scripts/migrations";

/*
 * Code and schema stay in step: every table read with .from("x") and every function called
 * with .rpc("x") must be created by a migration. Catches code left pointing at a dropped or
 * renamed table, which unit tests with in-memory repositories can't see.
 */
const root = process.cwd();
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const sql = loadMigrations()
  .map((m) => m.body)
  .join("\n");
const tables = new Set([...sql.matchAll(/create table (?:if not exists )?(?:public\.)?(\w+)/gi)].map((m) => m[1]));
const functions = new Set([...sql.matchAll(/create (?:or replace )?function (?:public\.)?(\w+)\s*\(/gi)].map((m) => m[1]));
/** Supabase-provided objects referenced by code. */
const PROVIDED = new Set<string>([]);
/** Company tenancy keeps the SaaS route switched off; `bootstrap --saas` installs its migration (then it must exist). */
const SAAS_ONLY = new Set(APP_CONFIG.tenancy === "saas" ? [] : ["create_organization"]);

describe("schema references", () => {
  const code = sourceFiles(path.join(root, "src")).map((file) => ({ file, text: readFileSync(file, "utf8") }));

  it("every .from() table exists in a migration", () => {
    const missing = code.flatMap(({ file, text }) =>
      [...text.matchAll(/\.from\("(\w+)"\)/g)]
        .map((m) => m[1])
        .filter((t) => !tables.has(t) && !PROVIDED.has(t))
        .map((t) => `${path.relative(root, file)} → ${t}`),
    );
    expect(missing).toEqual([]);
  });

  it("every .rpc() function exists in a migration", () => {
    const missing = code.flatMap(({ file, text }) =>
      [...text.matchAll(/\.rpc\("(\w+)"/g)]
        .map((m) => m[1])
        .filter((f) => !functions.has(f) && !SAAS_ONLY.has(f))
        .map((f) => `${path.relative(root, file)} → ${f}`),
    );
    expect(missing).toEqual([]);
  });
});
