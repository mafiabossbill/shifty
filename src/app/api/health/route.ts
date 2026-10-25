import { NextResponse, connection } from "next/server";

/**
 * Public liveness check for scripts/verify-production and uptime monitors.
 * `?deep=1` also checks that Supabase Auth answers. Never returns secrets or data.
 */
export async function GET(request: Request) {
  await connection();
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  const body: Record<string, unknown> = {
    status: "ok",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    environment: process.env.VERCEL_ENV ?? "local",
    time: new Date().toISOString(),
  };
  if (deep) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let supabase = "not_configured";
    if (url && key) {
      try {
        const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key }, cache: "no-store", signal: AbortSignal.timeout(5000) });
        supabase = res.ok ? "ok" : `http_${res.status}`;
      } catch {
        supabase = "unreachable";
      }
    }
    body.supabase = supabase;
    if (supabase !== "ok") body.status = "degraded";
  }
  return NextResponse.json(body, { status: body.status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
