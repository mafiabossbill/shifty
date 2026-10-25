import { connection } from "next/server";

import { apiSignedIn } from "@/lib/current-user";
import { logEvent } from "@/lib/log";
import { supabaseConfigured } from "@/lib/supabase/env";
import type { StatusResponse } from "@/lib/sync/contract";

import { syncJson } from "../_lib/pipeline";

/**
 * GET /api/sync/status — always 200. Tells the app whether sync exists on this deployment and who is signed
 * in, plus the server clock (the device keeps its offset). Never calls Supabase when it isn't configured.
 */
export async function GET() {
  await connection();
  const data: StatusResponse["data"] = { configured: supabaseConfigured(), signedIn: false, userId: null, email: null, serverTime: Date.now() };
  if (data.configured) {
    try {
      const { user } = await apiSignedIn();
      if (user) Object.assign(data, { signedIn: true, userId: user.id, email: user.email || null });
    } catch (error) {
      // Auth unreachable: report signed out rather than failing; the app retries later.
      logEvent("warn", "sync.status_auth_unavailable", { message: (error as Error).message.slice(0, 200) });
    }
  }
  data.serverTime = Date.now();
  return syncJson({ data } satisfies StatusResponse);
}
