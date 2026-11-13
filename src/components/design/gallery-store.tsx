"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { ShiftProvider, useShiftStore } from "@/lib/store/react";
import type { ShiftStore } from "@/lib/store/store";

/**
 * Which sample a gallery page starts from:
 *   "demo"   ten weeks of generated history (src/lib/demo/seed.ts): the full state of a screen
 *   "empty"  nothing recorded yet: the first thing a new person sees
 */
export type GallerySample = "demo" | "empty";

/** Brings the store to another state through its own actions (clock in, start a break, add a session…). */
export type GalleryPrepare = (store: ShiftStore) => Promise<unknown>;

/** The key `demoRequested()` reads (src/lib/demo/seed.ts): it makes the tab's store an in-memory demo store. */
const DEMO_KEY = "shifty-demo";

/** One store per tab (src/lib/store/react.tsx). The page it was prepared for, and the preparation itself. */
let preparedFor: string | null = null;
const prepared = new WeakMap<ShiftStore, Promise<void>>();

const noop = () => () => undefined;
const useIsBrowser = () => useSyncExternalStore(noop, () => true, () => false);

function untilReady(store: ShiftStore): Promise<void> {
  return new Promise((resolve) => {
    if (store.getSnapshot().ready) return resolve();
    const stop = store.subscribe(() => {
      if (!store.getSnapshot().ready) return;
      stop();
      resolve();
    });
  });
}

function Prepared({ sample, prepare, fallback, children }: { sample: GallerySample; prepare?: GalleryPrepare; fallback: React.ReactNode; children: React.ReactNode }) {
  const store = useShiftStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const page = window.location.pathname;
    // Reached by a link from another gallery page: the tab still holds that page's store. Start clean.
    if (preparedFor !== null && preparedFor !== page) {
      window.location.reload();
      return;
    }
    preparedFor = page;
    let run = prepared.get(store);
    if (!run) {
      run = (async () => {
        await untilReady(store);
        // The store exists now, so the flag has done its job: the app itself opens with real data again.
        try {
          window.sessionStorage.removeItem(DEMO_KEY);
        } catch {
          // Storage blocked: there was no flag to remove.
        }
        if (sample === "empty") await store.wipeDevice();
        await prepare?.(store);
      })();
      prepared.set(store, run);
    }
    void run.then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [store, sample, prepare]);
  return ready ? children : <div data-gallery-pending>{fallback}</div>;
}

function BrowserStore(props: React.ComponentProps<typeof Prepared>) {
  // Before <ShiftProvider> creates the tab's store: ask for the in-memory demo store, so a gallery
  // page never reads or writes this browser's real data and never syncs.
  const [asked] = useState(() => {
    try {
      window.sessionStorage.setItem(DEMO_KEY, "1");
      return true;
    } catch {
      return false;
    }
  });
  // Without the flag the store would open this browser's own data: show nothing rather than that.
  if (!asked) return <p className="p-4 text-muted-foreground">The gallery needs session storage to load its sample data. Allow site storage, then reload.</p>;
  return (
    <ShiftProvider>
      <Prepared {...props} />
    </ShiftProvider>
  );
}

/**
 * The device store for a gallery page, holding sample data instead of this browser's own. Screens
 * read `useShift()` exactly as they do in the app; nothing is saved and nothing syncs (the store is
 * the app's demo store: in memory, no transport). `prepare` then drives it to any other state the
 * screen plan lists (an active session, on a break…) with the store's real actions.
 * Children render once the sample is in place; `fallback` shows until then.
 */
export function GalleryStore({
  sample = "demo",
  prepare,
  fallback = null,
  children,
}: {
  sample?: GallerySample;
  prepare?: GalleryPrepare;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isBrowser = useIsBrowser();
  if (!isBrowser) return <div data-gallery-pending>{fallback}</div>;
  return (
    <BrowserStore sample={sample} prepare={prepare} fallback={fallback}>
      {children}
    </BrowserStore>
  );
}
