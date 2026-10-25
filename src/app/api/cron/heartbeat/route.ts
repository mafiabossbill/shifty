import { NextResponse, connection } from "next/server";

import { jsonError } from "@/lib/api";
import { authorizedCron } from "@/lib/cron-auth";
import { logEvent } from "@/lib/log";

/**
 * Example scheduled job. Called by Supabase pg_cron + pg_net with
 * `Authorization: Bearer <CRON_SECRET>` (URL and secret read from Supabase Vault;
 * see supabase/optional/cron.sql.example). Real jobs: claim work in a ledger table
 * with a unique key first, so overlapping or repeated ticks never act twice.
 */
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    logEvent("error", "cron.heartbeat.misconfigured", { reason: "CRON_SECRET is not set" });
    return jsonError(503, "Cron is not configured (CRON_SECRET is not set).");
  }
  if (!authorizedCron(request.headers.get("authorization"), secret)) {
    logEvent("warn", "cron.heartbeat.unauthorized");
    return jsonError(401, "Unauthorized.");
  }
  logEvent("info", "cron.heartbeat.done");
  return NextResponse.json({ data: { ok: true } });
}
