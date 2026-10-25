/**
 * Local notifications, app badge and platform hints (decision D07: no server push in phase 1).
 * Every helper is feature-detected and safe to call on iOS, desktop and during SSR: none throws.
 * UA sniffing here is for install guidance only, never for security or data decisions.
 */

export type NotificationPermissionState = NotificationPermission | "unsupported";

export type NotificationSupport = {
  /** The Notification API exists in this context. */
  supported: boolean;
  permission: NotificationPermissionState;
  /** iPhone/iPad in a browser tab: notifications only work from the home-screen app (iOS 16.4+). */
  needsInstall: boolean;
  /** Running as an installed app (home screen / desktop window). */
  standalone: boolean;
};

export type PlatformHints = { ios: boolean; android: boolean; safari: boolean; chrome: boolean };

export type LocalNotificationOptions = {
  body?: string;
  /** Same tag replaces the previous notification instead of stacking. */
  tag?: string;
  /** Same-origin path opened on click (service worker notificationclick). Defaults to "/". */
  url?: string;
};

type NavigatorExtras = Navigator & {
  standalone?: boolean;
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function nav(): NavigatorExtras | undefined {
  return typeof navigator === "undefined" ? undefined : (navigator as NavigatorExtras);
}

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function notificationApi(): typeof Notification | undefined {
  if (!hasWindow()) return undefined;
  const api = (globalThis as { Notification?: typeof Notification }).Notification;
  return typeof api === "function" ? api : undefined;
}

/** Installed app: `display-mode: standalone` (all) or `navigator.standalone` (iOS Safari). */
export function isStandalone(): boolean {
  if (!hasWindow()) return false;
  try {
    if (nav()?.standalone === true) return true;
    return typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    return false;
  }
}

/** Rough platform from the user agent, for showing the right install steps. */
export function platformHints(): PlatformHints {
  const n = nav();
  const ua = n?.userAgent ?? "";
  // iPadOS 13+ reports a Mac UA; touch points give it away.
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (n?.maxTouchPoints ?? 0) > 1);
  const android = /Android/i.test(ua);
  const chrome = /Chrome|CriOS|Chromium|EdgA|EdgiOS|Edg\//i.test(ua);
  const safari = /Safari/i.test(ua) && !chrome && !/FxiOS|Firefox|Android/i.test(ua);
  return { ios, android, safari, chrome };
}

export function notificationSupport(): NotificationSupport {
  const api = notificationApi();
  const standalone = isStandalone();
  const { ios } = platformHints();
  let permission: NotificationPermissionState = "unsupported";
  try {
    if (api) permission = api.permission;
  } catch {
    permission = "unsupported";
  }
  return { supported: Boolean(api), permission, needsInstall: ios && !standalone, standalone };
}

/** Ask for permission. Call only from a user gesture (a button tap); browsers ignore or penalize other calls. */
export async function requestNotifications(): Promise<NotificationPermissionState> {
  const api = notificationApi();
  if (!api) return "unsupported";
  try {
    if (api.permission !== "default") return api.permission;
    // Old Safari only supports the callback form.
    const result = await new Promise<NotificationPermission>((resolve) => {
      const maybe = api.requestPermission((value) => resolve(value));
      if (maybe && typeof maybe.then === "function") maybe.then(resolve, () => resolve(api.permission));
    });
    return result;
  } catch {
    try {
      return api.permission;
    } catch {
      return "unsupported";
    }
  }
}

async function activeRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  try {
    const container = nav()?.serviceWorker;
    if (!container) return undefined;
    // getRegistration resolves even when no worker exists (dev); `ready` alone would hang forever.
    const registration = await container.getRegistration();
    if (!registration) return undefined;
    if (registration.active) return registration;
    return await Promise.race([
      container.ready,
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1500)),
    ]);
  } catch {
    return undefined;
  }
}

/**
 * Show a notification now, while the app is open or recently backgrounded. Prefers the
 * service worker (required on Android, works on iOS home-screen apps), falls back to
 * `new Notification`. Resolves false when not permitted or not possible; never throws.
 */
export async function showLocalNotification(title: string, options: LocalNotificationOptions = {}): Promise<boolean> {
  const api = notificationApi();
  if (!api) return false;
  try {
    if (api.permission !== "granted") return false;
  } catch {
    return false;
  }
  const url = options.url && options.url.startsWith("/") && !options.url.startsWith("//") ? options.url : "/";
  const init: NotificationOptions = {
    body: options.body ?? "",
    tag: options.tag,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url },
  };
  const registration = await activeRegistration();
  if (registration && typeof registration.showNotification === "function") {
    try {
      await registration.showNotification(title, init);
      return true;
    } catch {
      /* fall through to the page-level constructor */
    }
  }
  try {
    new api(title, init);
    return true;
  } catch {
    // Android Chrome throws "Illegal constructor": only the service worker may notify there.
    return false;
  }
}

export function badgeSupported(): boolean {
  return typeof nav()?.setAppBadge === "function";
}

/** Home-screen / dock badge (installed apps on iOS 16.4+, desktop Chrome/Edge, some Android launchers). */
export async function setBadge(count: number): Promise<boolean> {
  const n = nav();
  if (!n || typeof n.setAppBadge !== "function") return false;
  if (!Number.isFinite(count) || count <= 0) return clearBadge();
  try {
    await n.setAppBadge(Math.floor(count));
    return true;
  } catch {
    return false;
  }
}

export async function clearBadge(): Promise<boolean> {
  const n = nav();
  try {
    if (n && typeof n.clearAppBadge === "function") {
      await n.clearAppBadge();
      return true;
    }
    if (n && typeof n.setAppBadge === "function") {
      await n.setAppBadge(0);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** Background Sync API present (Chromium only). Elsewhere the app syncs when it is opened or comes back online. */
export function backgroundSyncSupported(): boolean {
  if (!hasWindow()) return false;
  const registration = (globalThis as { ServiceWorkerRegistration?: { prototype: object } }).ServiceWorkerRegistration;
  return Boolean(registration && "sync" in registration.prototype);
}
