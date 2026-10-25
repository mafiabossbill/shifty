"use client";

import * as React from "react";
import { toast } from "sonner";

import { listenForInstallPrompt } from "@/lib/pwa/install-prompt";

const UPDATE_TOAST_ID = "sw-update-ready";

/**
 * Registers public/sw.js in production. `updateViaCache: "none"` plus the no-cache
 * header in next.config.ts make the browser check for a new worker on every visit.
 * A new worker waits (it would otherwise swap the cached shell under an open page);
 * this shows "Update ready — Reload", then tells it to take over and reloads once.
 */
export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    // Catch Chrome's one-shot install event as early as possible, in every environment.
    listenForInstallPrompt();
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const container = navigator.serviceWorker;
    let reloadRequested = false;
    let registration: ServiceWorkerRegistration | undefined;

    const onControllerChange = () => {
      // The first install also claims the page; only reload when the person asked for the update.
      if (!reloadRequested) return;
      reloadRequested = false;
      window.location.reload();
    };

    const offerUpdate = (worker: ServiceWorker) => {
      toast("Update ready", {
        id: UPDATE_TOAST_ID,
        description: "A new version of SHIFTY is ready.",
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: "Reload",
          onClick: () => {
            reloadRequested = true;
            worker.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    };

    const watch = (reg: ServiceWorkerRegistration) => {
      // A worker already waiting from an earlier visit.
      if (reg.waiting && container.controller) offerUpdate(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          // No controller means this is the first install, not an update.
          if (installing.state === "installed" && container.controller) offerUpdate(installing);
        });
      });
    };

    // Installed apps stay open for days: look for a new version when they come back to the foreground.
    const onVisible = () => {
      if (document.visibilityState === "visible") registration?.update().catch(() => undefined);
    };

    container.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisible);
    container
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        registration = reg;
        watch(reg);
      })
      .catch(() => undefined);

    return () => {
      container.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
