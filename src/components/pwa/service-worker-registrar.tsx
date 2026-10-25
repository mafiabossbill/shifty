"use client";

import * as React from "react";

/**
 * Registers public/sw.js. `updateViaCache: "none"` plus the no-cache header in
 * next.config.ts means a new worker is picked up on the next visit; it activates
 * immediately (skipWaiting) because it caches nothing a page depends on.
 */
export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
  }, []);
  return null;
}
