/** Reachable without a session. Every other page redirects to /login (src/proxy.ts). */
export const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/privacy",
  "/terms",
  "/cookies",
  "/data-deletion",
] as const;

/**
 * The design gallery (src/app/design): every screen rendered with sample data and no session, so it can be
 * looked at and photographed while it is being built. It exists in development only; in a production
 * build its layout answers 404 and this path is not public.
 */
export const DESIGN_GALLERY_PATH = "/design";

export function isPublicPath(pathname: string, env: string | undefined = process.env.NODE_ENV): boolean {
  const paths: readonly string[] = env === "production" ? PUBLIC_PATHS : [...PUBLIC_PATHS, DESIGN_GALLERY_PATH];
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
