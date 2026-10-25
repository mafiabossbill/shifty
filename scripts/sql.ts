/**
 * Runs SQL over HTTPS through the Supabase Management API
 * (POST /v1/projects/{ref}/database/query), so migrations work from cloud
 * sessions and CI that can't open a Postgres connection.
 *
 * Needs SUPABASE_ACCESS_TOKEN and the project ref (SUPABASE_PROJECT_REF, or derived
 * from NEXT_PUBLIC_SUPABASE_URL).  CLI: `npm run db:sql -- "select 1"` or `-- -f file.sql`.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

export function projectRef(): string {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const match = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/);
  if (!match) throw new Error("Set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL.");
  return match[1];
}

export async function sql<T = Record<string, unknown>>(query: string): Promise<T[]> {
  if (process.env.LOCAL_DATABASE_URL) return localSql<T>(process.env.LOCAL_DATABASE_URL, query);
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is not set.");
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef()}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message = (body as { message?: string } | null)?.message ?? response.statusText;
    throw new Error(`SQL failed (${response.status}): ${message}`);
  }
  return (Array.isArray(body) ? body : []) as T[];
}

/**
 * Same contract against a local Postgres through psql (scripts/db-local-check.sh).
 * Returns the rows of the last statement, parsed from CSV as strings.
 */
function localSql<T>(url: string, query: string): T[] {
  const result = spawnSync("psql", [url, "-X", "-q", "-v", "ON_ERROR_STOP=1", "--csv"], { input: query, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`SQL failed: ${(result.stderr || result.stdout).trim()}`);
  const lines = result.stdout.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => Object.fromEntries(line.split(",").map((value, i) => [header[i], value])) as T);
}

/** Quotes a value as a SQL literal. */
export function lit(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Not a finite number: ${value}`);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${value.replaceAll("'", "''")}'`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const query = args[0] === "-f" ? readFileSync(args[1], "utf8") : args.join(" ");
  sql(query).then(
    (rows) => console.log(JSON.stringify(rows, null, 2)),
    (error: Error) => {
      console.error(error.message);
      process.exit(1);
    },
  );
}
