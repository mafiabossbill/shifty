import "server-only";

import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { apiSession, type Session } from "@/lib/current-user";
import { shiftRepositoryFor, type ShiftRepository } from "@/lib/data/shifts";
import { logEvent } from "@/lib/log";
import { can, type Role } from "@/lib/permissions";
import { supabaseConfigured } from "@/lib/supabase/env";

export const NOT_CONFIGURED = "Sync isn't set up yet: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";

/** The capability every sync route needs (admin + member, blueprint roles). */
export function canTrackShifts(user: { role: Role }): boolean {
  return can(user, "shift:track");
}

/** Sync answers are per person and per moment: never cached anywhere. */
export function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function syncJson(body: unknown, status = 200) {
  return noStore(NextResponse.json(body, { status }));
}

export function syncError(status: number, message: string) {
  return noStore(jsonError(status, message));
}

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF walls for state-changing requests, on top of SameSite=Lax cookies: a browser that says the request
 * came from another site (Sec-Fetch-Site: cross-site) is refused; same-origin, same-site and none (typed
 * URL, bookmarks) pass, and so does a missing header (older browsers). The body must be declared JSON,
 * which a plain HTML form or a "simple" cross-site fetch can't do without a preflight.
 */
export function refuseUnsafeRequest(request: Request): Response | null {
  if (!STATE_CHANGING.has(request.method.toUpperCase())) return null;
  if (request.headers.get("sec-fetch-site")?.trim().toLowerCase() === "cross-site") {
    return syncError(403, "This request came from another site, so it was refused.");
  }
  const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (type !== "application/json") return syncError(415, "Send the body as JSON (Content-Type: application/json).");
  return null;
}

/** request checks → configured → session → capability → repository; or the 403/415/503/401 response to send. */
export async function syncSession(request?: Request): Promise<
  { session: Session; repo: ShiftRepository; response?: never } | { session?: never; repo?: never; response: Response }
> {
  const refused = request ? refuseUnsafeRequest(request) : null;
  if (refused) return { response: refused };
  if (!supabaseConfigured()) return { response: syncError(503, NOT_CONFIGURED) };
  let result: Awaited<ReturnType<typeof apiSession>>;
  try {
    result = await apiSession();
  } catch (error) {
    logEvent("error", "sync.session_failed", { message: (error as Error).message.slice(0, 200) });
    return { response: syncError(500, "Couldn't reach the sync server. Your changes are safe on this device; try again in a moment.") };
  }
  if (!result.session) return { response: noStore(result.response) };
  if (!canTrackShifts(result.session.user)) {
    return { response: syncError(403, "Your account can't track shifts in this workspace. Ask an admin to change your role.") };
  }
  return { session: result.session, repo: shiftRepositoryFor(result.session) };
}
