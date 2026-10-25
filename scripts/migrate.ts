/**
 * Applies supabase/migrations/*.sql in order, each in its own transaction together
 * with its row in supabase_migrations.schema_migrations (the Supabase CLI's table,
 * so `supabase db push` agrees on what is applied). Applied versions are skipped.
 *
 *   npm run db:migrate              apply pending migrations
 *   npm run db:migrate -- --status  list applied / pending, change nothing
 *
 * Refuses to run when two files share a version (scripts/migrations.ts) or when the
 * database has a version that no local file explains (someone applied SQL by hand or
 * from another branch): fix the history first, never paper over it.
 */
import { loadMigrations } from "./migrations";
import { lit, sql } from "./sql";

async function main() {
  const migrations = loadMigrations();
  await sql(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
  `);
  const applied = new Set(
    (await sql<{ version: string }>("select version from supabase_migrations.schema_migrations")).map((row) => row.version),
  );
  const local = new Set(migrations.map((m) => m.version));
  const unknown = [...applied].filter((version) => !local.has(version));
  if (unknown.length) {
    throw new Error(`The database has migration versions with no local file: ${unknown.join(", ")}. Pull the branch that added them first.`);
  }
  const pending = migrations.filter((m) => !applied.has(m.version));

  if (process.argv.includes("--status")) {
    for (const m of migrations) console.log(`${applied.has(m.version) ? "✓ applied" : "· pending"}  ${m.file}`);
    console.log(`${pending.length} pending.`);
    return;
  }

  for (const m of pending) {
    await sql(`begin;
${m.body}
;
insert into supabase_migrations.schema_migrations (version, name, statements)
values (${lit(m.version)}, ${lit(m.name)}, array[${lit(m.body)}]);
commit;`);
    console.log(`→ ${m.file} applied`);
  }
  console.log(pending.length === 0 ? "Database is up to date." : `${pending.length} migration(s) applied.`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
