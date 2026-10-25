"use client";

/**
 * PLACEHOLDER until the PWA lane's `src/lib/notify.ts` is wired (orchestrator: replace this module's
 * use in session-settings.tsx with `@/lib/notify`). Asks for notification permission, feature-detected,
 * and only from inside a user gesture (the switch's onCheckedChange).
 */
export type PermissionAnswer = "granted" | "denied" | "default" | "unsupported";

export function notificationSupport(): PermissionAnswer {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function askNotificationPermission(): Promise<PermissionAnswer> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}
