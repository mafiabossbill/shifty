import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/** SHIFTY's own Supabase project, when configured: REST/Auth over https and Realtime over wss. */
function supabaseConnectSources(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return [];
  try {
    const url = new URL(raw);
    if (url.protocol === "https:") return [url.origin, `wss://${url.host}`];
    // Local Supabase (supabase start) runs on plain http.
    if (url.protocol === "http:" && isDev) return [url.origin, `ws://${url.host}`];
  } catch {
    // An unparseable URL adds nothing; the app reports sync as broken instead.
  }
  return [];
}

/**
 * Page Content-Security-Policy. Scripts: Next's inline bootstrap and the theme no-flash script need
 * 'unsafe-inline' (no nonce: pages are prerendered static shells); dev tooling also needs 'unsafe-eval'.
 * next/font self-hosts fonts under /_next/static/media, so font-src 'self' is enough. Supabase origins are
 * read at build time, like every NEXT_PUBLIC_ value.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  ["connect-src 'self'", ...supabaseConnectSources()].join(" "),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Pages that read the session stream behind <Suspense>; everything else prerenders.
  cacheComponents: true,
  poweredByHeader: false,
  async headers() {
    // Order matters: when two rules set the same header, the later one wins, so /sw.js keeps its own CSP.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
      {
        // Always revalidate the service worker so a new version rolls out on the next visit.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
