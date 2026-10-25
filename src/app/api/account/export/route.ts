import { APP_CONFIG } from "@/lib/app-config";
import { jsonError } from "@/lib/api";
import { apiSignedIn } from "@/lib/current-user";
import { exportAccountData } from "@/lib/data/account";
import { logEvent } from "@/lib/log";
import { supabaseConfigured } from "@/lib/supabase/env";

/** GET /api/account/export — the signed-in person's data as a JSON download (Settings → Your data). */
export async function GET() {
  if (!supabaseConfigured()) {
    return jsonError(503, "Accounts aren't set up on this deployment. Export your data from Settings → Data instead: it lives on this device.");
  }
  const { user, supabase, response } = await apiSignedIn();
  if (!user) return response;
  let data: Record<string, unknown>;
  try {
    data = await exportAccountData(supabase, user.id);
  } catch (error) {
    logEvent("error", "account.export_failed", { profile_id: user.id, message: (error as Error).message.slice(0, 200) });
    return jsonError(500, "Couldn't prepare your data. Try again in a moment.");
  }
  logEvent("info", "account.exported", { profile_id: user.id });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${APP_CONFIG.shortName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-my-data-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
