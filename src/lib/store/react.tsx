"use client";

/**
 * React bindings for the device store. One store per tab; it syncs on launch, when the page becomes
 * visible, when the network returns and every minute while open. iOS has no reliable Background Sync,
 * so foreground triggers are the contract — never a service-worker timer.
 */
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { IndexedDbPersistence, MemoryPersistence, requestPersistentStorage } from "./persistence";
import { ShiftStore, type StoreDeps, type StoreView } from "./store";
import { httpTransport } from "@/lib/sync/transport";

const StoreContext = createContext<ShiftStore | null>(null);

let singleton: ShiftStore | null = null;

function createStore(extra?: Partial<StoreDeps>): ShiftStore {
  const hasIdb = typeof indexedDB !== "undefined";
  return new ShiftStore({
    persistence: hasIdb ? new IndexedDbPersistence() : new MemoryPersistence(),
    transport: httpTransport,
    online: () => (typeof navigator === "undefined" ? true : navigator.onLine),
    ...extra,
  });
}

export function ShiftProvider({ children, derive }: { children: ReactNode; derive?: StoreDeps["derive"] }) {
  const [store] = useState(() => (singleton ??= createStore({ derive })));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!store.getSnapshot().ready) await store.init();
      if (cancelled) return;
      void requestPersistentStorage();
      await store.applyRetention().catch(() => undefined);
      await store.checkSafetyLimit();
      void store.syncNow();
    })();
    const wake = () => {
      if (document.visibilityState === "visible") {
        void store.checkSafetyLimit();
        store.scheduleSync(0);
      }
    };
    const online = () => store.scheduleSync(0);
    const offline = () => void store.syncNow();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", wake);
    const minute = setInterval(() => {
      if (document.visibilityState === "visible") store.scheduleSync(0);
    }, 60_000);
    const safety = setInterval(() => void store.checkSafetyLimit(), 15_000);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", wake);
      clearInterval(minute);
      clearInterval(safety);
    };
  }, [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useShiftStore(): ShiftStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useShiftStore must be used inside <ShiftProvider>.");
  return store;
}

const SERVER_VIEW: StoreView | null = null;

/** The current view (sessions, active session, profile, sync state). Re-renders on every change. */
export function useShift(): StoreView {
  const store = useShiftStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => SERVER_VIEW ?? store.getSnapshot());
}

/**
 * Authoritative "now", re-rendering every `intervalMs` while mounted. Elapsed time is always computed
 * from timestamps with this value — ticks only trigger a repaint, they are never added up.
 */
export function useNow(intervalMs = 1_000): number {
  const store = useShiftStore();
  const [now, setNow] = useState(() => store.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = store.now();
      setNow(t);
      // Align to the next whole interval so the seconds digit flips on time.
      timer = setTimeout(tick, intervalMs - (t % intervalMs) + 5);
    };
    tick();
    const onVisible = () => document.visibilityState === "visible" && setNow(store.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [store, intervalMs]);
  return now;
}
