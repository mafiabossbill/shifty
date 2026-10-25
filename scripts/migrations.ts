/**
 * Reads supabase/migrations and refuses ambiguous sets. Shared by the runner
 * (scripts/migrate.ts) and the unit test (tests/migrations.test.ts).
 *
 * Lesson from a real project: two parallel sessions both wrote 0080_*.sql and the runner
 * silently skipped one because the version was "already applied". Versions must be
 * unique, so a duplicate is an error here, before anything touches a database.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export interface Migration {
  version: string;
  name: string;
  file: string;
  body: string;
}

export function loadMigrations(dir = path.join(process.cwd(), "supabase", "migrations")): Migration[] {
  const files = readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();
  const migrations: Migration[] = [];
  const seen = new Map<string, string>();
  for (const file of files) {
    const match = file.match(/^(\d{4})_([a-z0-9_]+)\.sql$/);
    if (!match) throw new Error(`Migration file names must look like 0010_add_things.sql: ${file}`);
    const [, version, name] = match;
    const clash = seen.get(version);
    if (clash) throw new Error(`Duplicate migration version ${version}: ${clash} and ${file}. Renumber one inside its owner's range.`);
    seen.set(version, file);
    migrations.push({ version, name, file, body: readFileSync(path.join(dir, file), "utf8") });
  }
  return migrations;
}
