import { firstIssue, readJson } from "@/lib/api";
import { logEvent } from "@/lib/log";
import type { PushResponse } from "@/lib/sync/contract";
import { syncPushSchema } from "@/lib/validation";

import { syncError, syncJson, syncSession } from "../_lib/pipeline";
import { pushEvents } from "../_lib/push";

/**
 * POST /api/sync/events — an ordered batch of 1…100 device events. Each gets its own result (applied /
 * duplicate / rejected) in the same order; one bad event never blocks the others. 200 whenever the batch
 * itself was readable, because per-event outcomes live in the results.
 */
export async function POST(request: Request) {
  const { session, repo, response } = await syncSession(request);
  if (!session) return response;
  const parsed = syncPushSchema.safeParse(await readJson(request));
  if (!parsed.success) return syncError(400, firstIssue(parsed.error));

  try {
    const { results, counts } = await pushEvents(repo, parsed.data.events, Date.now(), session.user.id);
    logEvent("info", "sync.pushed", { user_id: session.user.id, events: results.length, ...counts });
    return syncJson({ data: { results, serverTime: Date.now() } } satisfies PushResponse);
  } catch (error) {
    logEvent("error", "sync.push_failed", { user_id: session.user.id, events: parsed.data.events.length, message: (error as Error).message.slice(0, 200) });
    return syncError(500, "Couldn't sync right now. Your changes are safe on this device; try again in a moment.");
  }
}
