/*
 * Slots in the shell that other lanes fill. They render nothing until their module lands;
 * the shell already reserves their place so nothing moves when they arrive.
 * Both must stay client-only and read only device state (no server session reads in the shell).
 */

/**
 * Top bar, right side: the device's sync state (On this device / Syncing / Synced / Needs attention).
 * TODO(sync lane): render `<SyncStatus />` from `@/components/sync/sync-status` here
 * (use `SyncStatePill` from `@/components/ui/status-pill` for the look).
 */
export function SyncStatusSlot() {
  return null;
}

/**
 * The persistent active-session ribbon: above the bottom bar on phones, at the top of the content
 * from 1024px (the shell moves this one element with CSS `order`, so it mounts once).
 * TODO(session lane): render `<ActiveRibbon />` from `@/components/session/active-ribbon` here.
 */
export function ActiveRibbonSlot() {
  return null;
}
