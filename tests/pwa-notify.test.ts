import { afterEach, describe, expect, it, vi } from "vitest";

import {
  backgroundSyncSupported,
  badgeSupported,
  clearBadge,
  isStandalone,
  notificationSupport,
  platformHints,
  requestNotifications,
  setBadge,
  showLocalNotification,
} from "@/lib/notify";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
  ipadDesktopMode: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
};

type Env = {
  ua?: string;
  touchPoints?: number;
  standaloneMedia?: boolean;
  iosStandalone?: boolean;
  notification?: unknown;
  serviceWorker?: unknown;
  badge?: { set?: (n?: number) => Promise<void>; clear?: () => Promise<void> };
  syncInPrototype?: boolean;
};

function stubBrowser(env: Env = {}) {
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({ matches: query.includes("standalone") ? Boolean(env.standaloneMedia) : false }),
  });
  vi.stubGlobal("navigator", {
    userAgent: env.ua ?? UA.macChrome,
    maxTouchPoints: env.touchPoints ?? 0,
    standalone: env.iosStandalone,
    serviceWorker: env.serviceWorker,
    setAppBadge: env.badge?.set,
    clearAppBadge: env.badge?.clear,
  });
  vi.stubGlobal("Notification", env.notification);
  vi.stubGlobal("ServiceWorkerRegistration", env.syncInPrototype === undefined ? undefined : { prototype: env.syncInPrototype ? { sync: {} } : {} });
}

function fakeNotification(permission: NotificationPermission, onRequest?: () => NotificationPermission) {
  const constructed: unknown[] = [];
  const api = function (this: unknown, title: string, options: unknown) {
    constructed.push({ title, options });
  } as unknown as { permission: NotificationPermission; requestPermission: (cb?: (p: NotificationPermission) => void) => Promise<NotificationPermission> };
  api.permission = permission;
  api.requestPermission = vi.fn(async () => {
    api.permission = onRequest ? onRequest() : api.permission;
    return api.permission;
  });
  return { api, constructed };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SSR safety", () => {
  it("every helper is inert without window/navigator", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("navigator", undefined);
    vi.stubGlobal("Notification", undefined);
    expect(isStandalone()).toBe(false);
    expect(platformHints()).toEqual({ ios: false, android: false, safari: false, chrome: false });
    expect(notificationSupport()).toEqual({ supported: false, permission: "unsupported", needsInstall: false, standalone: false });
    expect(await requestNotifications()).toBe("unsupported");
    expect(await showLocalNotification("Hi")).toBe(false);
    expect(await setBadge(1)).toBe(false);
    expect(await clearBadge()).toBe(false);
    expect(badgeSupported()).toBe(false);
    expect(backgroundSyncSupported()).toBe(false);
  });
});

describe("platformHints", () => {
  it.each([
    ["iphoneSafari", 0, { ios: true, android: false, safari: true, chrome: false }],
    ["iphoneChrome", 0, { ios: true, android: false, safari: false, chrome: true }],
    ["ipadDesktopMode", 5, { ios: true, android: false, safari: true, chrome: false }],
    ["ipadDesktopMode", 0, { ios: false, android: false, safari: true, chrome: false }],
    ["androidChrome", 5, { ios: false, android: true, safari: false, chrome: true }],
    ["macChrome", 0, { ios: false, android: false, safari: false, chrome: true }],
    ["firefox", 0, { ios: false, android: false, safari: false, chrome: false }],
  ] as const)("%s (touch %i)", (ua, touchPoints, expected) => {
    stubBrowser({ ua: UA[ua], touchPoints });
    expect(platformHints()).toEqual(expected);
  });
});

describe("notificationSupport", () => {
  it("iPhone Safari tab: no Notification API, needs install", () => {
    stubBrowser({ ua: UA.iphoneSafari });
    expect(notificationSupport()).toEqual({ supported: false, permission: "unsupported", needsInstall: true, standalone: false });
  });

  it("iPhone home-screen app: supported, no install needed", () => {
    stubBrowser({ ua: UA.iphoneSafari, iosStandalone: true, notification: fakeNotification("default").api });
    expect(notificationSupport()).toEqual({ supported: true, permission: "default", needsInstall: false, standalone: true });
  });

  it("installed desktop app via display-mode", () => {
    stubBrowser({ standaloneMedia: true, notification: fakeNotification("granted").api });
    expect(isStandalone()).toBe(true);
    expect(notificationSupport().permission).toBe("granted");
  });
});

describe("requestNotifications", () => {
  it("asks only when the answer is still 'default'", async () => {
    const { api } = fakeNotification("default", () => "granted");
    stubBrowser({ notification: api });
    expect(await requestNotifications()).toBe("granted");
    expect(api.requestPermission).toHaveBeenCalledTimes(1);
    expect(await requestNotifications()).toBe("granted");
    expect(api.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("does not re-ask after a denial", async () => {
    const { api } = fakeNotification("denied");
    stubBrowser({ notification: api });
    expect(await requestNotifications()).toBe("denied");
    expect(api.requestPermission).not.toHaveBeenCalled();
  });

  it("supports the old callback-only Safari form", async () => {
    const api = { permission: "default" as NotificationPermission, requestPermission: (cb: (p: NotificationPermission) => void) => void cb("granted") };
    stubBrowser({ notification: Object.assign(function () {}, api) });
    expect(await requestNotifications()).toBe("granted");
  });
});

describe("showLocalNotification", () => {
  it("uses the service worker registration when one is active", async () => {
    const showNotification = vi.fn(async () => undefined);
    const { api, constructed } = fakeNotification("granted");
    stubBrowser({
      notification: api,
      serviceWorker: { getRegistration: async () => ({ active: {}, showNotification }), ready: new Promise(() => undefined) },
    });
    expect(await showLocalNotification("Time for a break", { body: "12h worked", tag: "milestone-12h", url: "/sessions" })).toBe(true);
    expect(showNotification).toHaveBeenCalledWith("Time for a break", expect.objectContaining({ body: "12h worked", tag: "milestone-12h", data: { url: "/sessions" } }));
    expect(constructed).toHaveLength(0);
  });

  it("falls back to new Notification without a worker (and never hangs on `ready`)", async () => {
    const { api, constructed } = fakeNotification("granted");
    stubBrowser({ notification: api, serviceWorker: { getRegistration: async () => undefined, ready: new Promise(() => undefined) } });
    expect(await showLocalNotification("Hi", { url: "https://evil.example/" })).toBe(true);
    expect(constructed).toEqual([{ title: "Hi", options: expect.objectContaining({ data: { url: "/" } }) }]);
  });

  it("returns false without permission or when the constructor is illegal (Android)", async () => {
    stubBrowser({ notification: fakeNotification("default").api });
    expect(await showLocalNotification("Hi")).toBe(false);

    const illegal = Object.assign(
      function () {
        throw new TypeError("Illegal constructor");
      },
      { permission: "granted", requestPermission: async () => "granted" },
    );
    stubBrowser({ notification: illegal, serviceWorker: { getRegistration: async () => undefined } });
    expect(await showLocalNotification("Hi")).toBe(false);
  });

  it("falls back when the worker's showNotification throws", async () => {
    const { api, constructed } = fakeNotification("granted");
    stubBrowser({
      notification: api,
      serviceWorker: {
        getRegistration: async () => ({
          active: {},
          showNotification: async () => {
            throw new TypeError("No active registration");
          },
        }),
      },
    });
    expect(await showLocalNotification("Hi")).toBe(true);
    expect(constructed).toHaveLength(1);
  });
});

describe("badge", () => {
  it("sets, clears on zero, and reports support", async () => {
    const set = vi.fn(async () => undefined);
    const clear = vi.fn(async () => undefined);
    stubBrowser({ badge: { set, clear } });
    expect(badgeSupported()).toBe(true);
    expect(await setBadge(3.7)).toBe(true);
    expect(set).toHaveBeenCalledWith(3);
    expect(await setBadge(0)).toBe(true);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(await clearBadge()).toBe(true);
  });

  it("is a no-op where the Badging API is missing, and swallows errors", async () => {
    stubBrowser();
    expect(badgeSupported()).toBe(false);
    expect(await setBadge(1)).toBe(false);
    expect(await clearBadge()).toBe(false);

    stubBrowser({
      badge: {
        set: async () => {
          throw new DOMException("Not allowed", "NotAllowedError");
        },
      },
    });
    expect(await setBadge(1)).toBe(false);
  });
});

describe("backgroundSyncSupported", () => {
  it("detects SyncManager on the registration prototype", () => {
    stubBrowser({ syncInPrototype: true });
    expect(backgroundSyncSupported()).toBe(true);
    stubBrowser({ syncInPrototype: false });
    expect(backgroundSyncSupported()).toBe(false);
  });
});
