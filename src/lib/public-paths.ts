/**
 * Pages that don't need a session. The tracking pages are a public static shell that reads this browser's
 * IndexedDB (device mode); no server data is ever public — every /api/* route checks the session itself.
 * Any other page sends a signed-out person to /login, but only when sync is configured (src/proxy.ts).
 */
export const DEVICE_SHELL_PATHS = ["/", "/sessions", "/insights", "/companion", "/settings"] as const;

export const AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback"] as const;

export const LEGAL_PATHS = ["/privacy", "/terms", "/cookies", "/data-deletion"] as const;

export const PUBLIC_PATHS = [...DEVICE_SHELL_PATHS, ...AUTH_PATHS, ...LEGAL_PATHS] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)));
}
