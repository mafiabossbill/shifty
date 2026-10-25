/*
 * Slots in the shell that other lanes fill. Both stay client-only and read only device state
 * (no server session reads in the shell). The ribbon reads the path, so it sits behind Suspense.
 */
import { Suspense } from "react";

import { ActiveRibbon } from "@/components/session/active-ribbon";
import { DemoBanner } from "@/components/sync/demo-banner";
import { SyncStatus } from "@/components/sync/sync-status";

/** Top bar, right side: the device's sync state (On this device / Syncing / Synced / Needs attention). */
export function SyncStatusSlot() {
  return <SyncStatus />;
}

/**
 * The persistent active-session ribbon: above the bottom bar on phones, at the top of the content
 * from 1024px (the shell moves this one element with CSS `order`, so it mounts once). The demo
 * banner shares the slot and can show together with the ribbon.
 */
export function ActiveRibbonSlot() {
  return (
    <>
      <DemoBanner />
      <Suspense fallback={null}>
        <ActiveRibbon />
      </Suspense>
    </>
  );
}
