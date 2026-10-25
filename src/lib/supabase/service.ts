import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { supabaseEnv } from "@/lib/supabase/env";

export class MissingServiceRoleKeyError extends Error {
  constructor() {
    super("SUPABASE_SERVICE_ROLE_KEY is not set. Jobs and webhooks that run without a signed-in user need it; set it in the deployment environment.");
  }
}

/**
 * Privileged client for work with no signed-in user (cron, webhooks, auth admin calls).
 * It bypasses RLS, so callers must scope every query to an organization themselves.
 * Never import this from a page, a client component or a user-facing route.
 */
export function createServiceClient(env: Record<string, string | undefined> = process.env): SupabaseClient {
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new MissingServiceRoleKeyError();
  return createClient(supabaseEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
