import { connection } from "next/server";

import { logEvent } from "@/lib/log";
import type { StateResponse } from "@/lib/sync/contract";

import { syncError, syncJson, syncSession } from "../_lib/pipeline";

/** GET /api/sync/state — every session the person owns (trash included) and their profile document. */
export async function GET() {
  await connection();
  const { session, repo, response } = await syncSession();
  if (!session) return response;
  try {
    const [sessions, profile] = await Promise.all([repo.loadSessions(), repo.loadProfile()]);
    return syncJson({ data: { sessions, profile, serverTime: Date.now() } } satisfies StateResponse);
  } catch (error) {
    logEvent("error", "sync.state_failed", { user_id: session.user.id, message: (error as Error).message.slice(0, 200) });
    return syncError(500, "Couldn't load your synced sessions. Your device copy is unchanged; try again in a moment.");
  }
}
