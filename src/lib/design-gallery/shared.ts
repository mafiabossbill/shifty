/**
 * Gallery pages that show the system and the shared parts rather than one signed-in screen (lane R0):
 * the system page, overlays held open, the shell in its states, and the sign-in forms (which only
 * render on a deployment with sync set up, so the gallery shows them with no backend).
 */
export const SYSTEM_PAGES = [
  "/design",
  "/design/overlays/dialog",
  "/design/overlays/confirm",
  "/design/overlays/sheet",
  "/design/shell",
  "/design/shell/empty",
  "/design/shell/loading",
  "/design/shell/error",
  "/design/auth/sign-in",
  "/design/auth/sign-in-error",
  "/design/auth/sign-up",
  "/design/auth/forgot-password",
] as const;

/**
 * Real pages outside the gallery that `npm run design:shots` photographs as well: they need no
 * session and no sample data. The last one does not exist on purpose: it shows the not-found page.
 */
export const PUBLIC_PAGES = ["/login", "/privacy", "/cookies", "/no-access", "/a-page-that-does-not-exist"] as const;
