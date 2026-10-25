import { firstIssue, readJson, repoErrorStatus } from "@/lib/api";
import { logEvent } from "@/lib/log";
import { profilePutSchema } from "@/lib/validation";

import { syncError, syncJson, syncSession } from "../_lib/pipeline";

/**
 * PUT /api/sync/profile — settings, companion, projects, places (last write wins by updatedAt) and the
 * append-only activities, reward ledger and achievements (duplicates ignored). Owner fields come from the
 * session; any unknown field, user_id included, is refused.
 */
export async function PUT(request: Request) {
  const { session, repo, response } = await syncSession();
  if (!session) return response;
  const parsed = profilePutSchema.safeParse(await readJson(request));
  if (!parsed.success) return syncError(400, firstIssue(parsed.error));

  try {
    const saved = await repo.saveProfile(parsed.data);
    if (!saved.ok) return syncError(repoErrorStatus(saved.error), saved.message);
  } catch (error) {
    logEvent("error", "sync.profile_failed", { user_id: session.user.id, message: (error as Error).message.slice(0, 200) });
    return syncError(500, "Couldn't save your settings to your account. They're kept on this device; try again in a moment.");
  }
  const d = parsed.data;
  logEvent("info", "sync.profile_saved", {
    user_id: session.user.id,
    settings: Boolean(d.settings),
    companion: Boolean(d.companion),
    projects: d.projects?.length ?? 0,
    places: d.places?.length ?? 0,
    activities: d.activities?.length ?? 0,
    ledger: d.ledger?.length ?? 0,
    achievements: d.achievements?.length ?? 0,
  });
  return syncJson({ data: { ok: true, serverTime: Date.now() } });
}
