"use client";

import { useSyncExternalStore } from "react";

import { useShift } from "@/lib/store/react";
import type { StoreView } from "@/lib/store/store";

const subscribe = () => () => {};

/** False while hydrating (server HTML), true after. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/**
 * useShift(), but `ready` stays false until hydration is done. useShift's server snapshot is the live
 * client snapshot, so a store that finished loading before a Suspense boundary hydrated would render
 * different HTML than the server did (hydration mismatch). Remove once src/lib/store/react.tsx returns
 * a constant not-ready snapshot from getServerSnapshot.
 */
export function useReadyShift(): StoreView {
  const view = useShift();
  const hydrated = useHydrated();
  return hydrated || !view.ready ? view : { ...view, ready: false };
}
