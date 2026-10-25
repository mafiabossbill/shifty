import "server-only";

import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { apiSession, type Session } from "@/lib/current-user";
import { shiftRepositoryFor, type ShiftRepository } from "@/lib/data/shifts";
import { logEvent } from "@/lib/log";
import { can, type Role } from "@/lib/permissions";
import { supabaseConfigured } from "@/lib/supabase/env";

export const NOT_CONFIGURED = "Sync isn't set up yet: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";

/**
 * The capability every sync route needs (admin + member, blueprint roles). Referenced in this one place
 * until the database lane adds it to src/lib/permissions.ts; then this becomes `can(user, "shift:track")`.
 */
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

/** session → capability → repository; or the 503/401/403 response to send. */
export async function syncSession(): Promise<
  { session: Session; repo: ShiftRepository; response?: never } | { session?: never; repo?: never; response: Response }
> {
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
