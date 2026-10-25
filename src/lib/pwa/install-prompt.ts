/**
 * Captures Chrome/Edge/Android's `beforeinstallprompt` so an "Install SHIFTY" button can
 * show the native prompt later. Start listening as early as possible (the registrar in the
 * root layout calls `listenForInstallPrompt()`), because the event fires once per page load.
 * Safari and Firefox never fire it; the install guide shows manual steps there.
 */

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let listening = false;
const subscribers = new Set<() => void>();

function notify() {
  for (const callback of subscribers) callback();
}

export function listenForInstallPrompt(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep the browser's mini-infobar quiet; the app offers install where it makes sense.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

export function subscribeInstallPrompt(callback: () => void): () => void {
  listenForInstallPrompt();
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/** True when the native install prompt can be shown right now. */
export function canPromptInstall(): boolean {
  return deferred !== null;
}

/** True after `appinstalled` fired in this page load. */
export function wasJustInstalled(): boolean {
  return installed;
}

/** Show the native prompt (from a tap). The event is single-use, so it is dropped afterwards. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferred;
  if (!event) return "unavailable";
  deferred = null;
  notify();
  try {
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome;
  } catch {
    return "unavailable";
  }
}
