import { createServerClient } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseEnv } from "@/lib/supabase/env";
import { isPublicPath } from "@/lib/public-paths";

/** Refreshes the Supabase session cookie on every request and sends signed-out page requests to /login. */
export async function proxy(request: NextRequest) {
  const { url, anonKey } = supabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Verifies the JWT (refreshing it when expired). A network hiccup reaching Supabase Auth is
  // retried once; if it persists the request goes through: pages and routes check the session
  // again themselves, and a 500 or /login bounce here would break background refreshes.
  let claims;
  try {
    claims = await supabase.auth.getClaims();
    if (claims.error && isAuthRetryableFetchError(claims.error)) claims = await supabase.auth.getClaims();
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "proxy.auth_unavailable", message: (error as Error).message }));
    return response;
  }
  if (claims.error && isAuthRetryableFetchError(claims.error)) {
    console.error(JSON.stringify({ level: "error", event: "proxy.auth_unavailable", message: claims.error.message }));
    return response;
  }
  const signedIn = Boolean(claims.data?.claims);
  const { pathname, search } = request.nextUrl;

  // API routes answer 401 themselves; only pages redirect.
  if (!signedIn && !isPublicPath(pathname) && !pathname.startsWith("/api/")) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return withCookies(NextResponse.redirect(login), response);
  }
  return response;
}

function withCookies(target: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}

export const config = {
  // PWA files (service worker, manifest, offline page, icons) must load signed out too.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|sw.js|manifest.webmanifest|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
