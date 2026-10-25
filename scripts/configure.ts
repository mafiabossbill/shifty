/**
 * One-time setup after the first migration: creates the first organization and
 * stores ADMIN_EMAIL for the admin bootstrap (private.app_settings, not exposed
 * by the API). The first sign-in with that confirmed email becomes its admin.
 *
 *   ADMIN_EMAIL=you@company.com ORG_NAME="Company" npm run db:configure
 */
import { APP_CONFIG } from "../src/lib/app-config";
import { lit, sql } from "./sql";

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "org";
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Set ADMIN_EMAIL to the first admin's email address.");
  const name = process.env.ORG_NAME?.trim() || APP_CONFIG.name;
  const slug = slugify(name);
  await sql(`
    insert into organizations (name, slug, timezone, currency)
    values (${lit(name)}, ${lit(slug)}, ${lit(APP_CONFIG.timezone)}, ${lit(APP_CONFIG.currency)})
    on conflict (slug) do nothing;
    insert into private.app_settings (key, value) values ('admin_email', ${lit(email)}), ('bootstrap_org_slug', ${lit(slug)})
    on conflict (key) do update set value = excluded.value;
  `);
  console.log(`Organization "${name}" (${slug}) is ready. The first confirmed sign-in as ${email} becomes its admin.`);
  console.log("Create that user in Supabase → Authentication → Users (Add user, auto-confirm) or invite them.");
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
