"use client";

import { useState } from "react";

import { SyncStatePill } from "@/components/ui/status-pill";
import { syncPill } from "@/lib/home/sync-view";
import { useHydrated } from "@/components/home/shared";
import { useShift } from "@/lib/store/react";

import { SyncSheet } from "./sync-sheet";

/** Top-bar sync state. Tap opens the explanation, Sync now and the Needs attention list. */
export function SyncStatus() {
  const view = useShift();
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();
  if (!view.ready || !hydrated) return <span className="inline-block h-7 w-28 rounded-full bg-raised motion-safe:animate-pulse" aria-hidden />;
  const pill = syncPill(view.sync);
  return (
    <>
      <button
        type="button"
        data-touch-target
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Sync: ${pill.label}. Show details`}
        className="cursor-pointer rounded-full focus-ring"
      >
        <SyncStatePill state={pill.state} label={pill.label} />
      </button>
      <SyncSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
