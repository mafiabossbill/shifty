/**
 * Points Supabase Cron (pg_cron + pg_net) at the deployed app and shows whether it really works.
 *
 * Stores APP_URL (or NEXT_PUBLIC_SITE_URL) and CRON_SECRET in Supabase Vault as
 * `<app>_app_url` / `<app>_cron_secret` (<app> = package.json name with dashes as underscores),
 * which the job functions read on every run (supabase/optional/cron.sql.example). Values go over
 * HTTPS to the Management API and are never printed.
 *
 *   APP_URL=https://app.example.com CRON_SECRET=… npm run db:cron
 *   npm run db:cron -- --status    jobs, secrets present, last runs AND last HTTP responses
 *
 * Lesson: cron.job_run_details says "succeeded" even when the job no-oped because a Vault secret
 * was missing. Only net._http_response proves the app was called (status_code 200).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { lit, sql } from "./sql";

const app = (JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as { name: string }).name.replace(/-/g, "_");
const URL_SECRET = `${app}_app_url`;
const CRON_SECRET_NAME = `${app}_cron_secret`;

async function upsertSecret(name: string, value: string, description: string) {
  await sql(`do $$
declare sid uuid;
begin
  select id into sid from vault.secrets where name = ${lit(name)};
  if sid is null then
    perform vault.create_secret(${lit(value)}, ${lit(name)}, ${lit(description)});
  else
    perform vault.update_secret(sid, ${lit(value)});
  end if;
end $$;`);
}

async function status() {
  const jobs = await sql<{ jobname: string; schedule: string; active: boolean }>(
    `select jobname, schedule, active from cron.job where jobname like ${lit(`${app}%`)} order by jobname`,
  );
  const configured = await sql<{ name: string }>(
    `select name from vault.secrets where name in (${lit(URL_SECRET)}, ${lit(CRON_SECRET_NAME)}) order by name`,
  );
  const runs = await sql<{ jobname: string; start_time: string; status: string; return_message: string }>(
    `select j.jobname, d.start_time, d.status, d.return_message from cron.job_run_details d
       join cron.job j using (jobid) where j.jobname like ${lit(`${app}%`)} order by d.start_time desc limit 6`,
  ).catch(() => []);
  const responses = await sql<{ created: string; status_code: number | null; error_msg: string | null }>(
    "select created, status_code, error_msg from net._http_response order by created desc limit 5",
  ).catch(() => []);
  console.log(jobs.length ? jobs.map((j) => `Job ${j.jobname}: ${j.schedule}, ${j.active ? "active" : "inactive"}`).join("\n") : "No jobs yet (copy supabase/optional/cron.sql.example into a migration).");
  console.log(`Vault secrets set: ${configured.map((c) => c.name).join(", ") || "none"} (need ${URL_SECRET}, ${CRON_SECRET_NAME})`);
  console.log("Last runs:", runs.length ? runs : "none yet");
  console.log("Last HTTP responses (the proof):", responses.length ? responses : "none yet");
}

async function main() {
  if (process.argv.includes("--status")) return status();
  const url = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!/^https:\/\//.test(url)) throw new Error("Set APP_URL (or NEXT_PUBLIC_SITE_URL) to the deployed https:// URL.");
  if (secret.length < 32) throw new Error("Set CRON_SECRET (32+ characters, the same value as in Vercel).");
  await upsertSecret(URL_SECRET, url, "Base URL called by Supabase Cron");
  await upsertSecret(CRON_SECRET_NAME, secret, "Bearer secret for /api/cron/*");
  console.log(`Supabase Cron will call ${url}/api/cron/* with the stored secret.`);
  await status();
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
