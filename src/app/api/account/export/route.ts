import { APP_CONFIG } from "@/lib/app-config";
import { apiSignedIn } from "@/lib/current-user";
import { exportAccountData } from "@/lib/data/account";
import { logEvent } from "@/lib/log";

/** GET /api/account/export — the signed-in person's data as a JSON download (Settings → Your data). */
export async function GET() {
  const { user, supabase, response } = await apiSignedIn();
  if (!user) return response;
  const data = await exportAccountData(supabase, user.id);
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
