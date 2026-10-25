"use client";

import Link from "next/link";
import { useState } from "react";
import { RefreshCwIcon, RotateCwIcon, Trash2Icon, UploadCloudIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SyncStatePill } from "@/components/ui/status-pill";
import { describeAttention, discardConsequence, lastSyncedLine, syncExplanation, syncPill } from "@/lib/home/sync-view";
import { useNow, useShift, useShiftStore } from "@/lib/store/react";
import { ShiftActionError } from "@/lib/store/store";
import { deviceTimeZone } from "@/lib/time/zone";

function message(error: unknown, fallback: string) {
  return error instanceof ShiftActionError ? error.message : error instanceof Error && error.message ? error.message : fallback;
}

export function SyncSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent onOpenAutoFocus={(e) => e.preventDefault()}>{open ? <SyncSheetBody onClose={() => onOpenChange(false)} /> : null}</SheetContent>
    </Sheet>
  );
}

function SyncSheetBody({ onClose }: { onClose: () => void }) {
  const view = useShift();
  const store = useShiftStore();
  const confirm = useConfirm();
  const now = useNow(15_000);
  const [busy, setBusy] = useState<string | null>(null);
  const { sync } = view;
  const clock = view.profile.settings.clock;
  const pill = syncPill(sync);
  const info = syncExplanation(sync);
  const items = sync.attention.map((e) => describeAttention(e, view.state.sessions, clock));

  const act = async (key: string, fn: () => Promise<unknown>, fallback: string) => {
    setBusy(key);
    try {
      await fn();
      return true;
    } catch (error) {
      toast.error(message(error, fallback));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <SheetHeader>
        <div>
          <SyncStatePill state={pill.state} label={pill.label} />
        </div>
        <SheetTitle>{info.title}</SheetTitle>
        <SheetDescription>{info.body}</SheetDescription>
      </SheetHeader>
      <SheetBody className="grid content-start gap-5">
        {sync.mode === "account" || sync.mode === "signed_out" ? (
          <p className="text-sm text-muted-foreground">
            {lastSyncedLine(sync.lastSyncedAt, now, deviceTimeZone(), clock)}
            {sync.pending > 0 ? ` · ${sync.pending} waiting on this device` : ""}
          </p>
        ) : null}
        {sync.phase === "error" && sync.message ? <p className="rounded-control bg-warning-soft px-3 py-2 text-sm text-warning-ink">{sync.message}</p> : null}

        {sync.mode === "attach_pending" ? (
          <div className="grid gap-3 rounded-card bg-raised p-4">
            <p className="text-sm">
              You&apos;re signed in{sync.email ? ` as ${sync.email}` : ""}. Upload the {view.sessions.length} {view.sessions.length === 1 ? "session" : "sessions"} saved on this
              device to your account?
            </p>
            <p className="text-xs text-muted-foreground">They stay on this device either way. After uploading, they sync with your account everywhere you sign in.</p>
            <Button
              disabled={busy !== null}
              onClick={() =>
                void act("attach", () => store.attachToAccount(), "Couldn't start the upload. Try again.").then((ok) => ok && toast.success("Uploading your sessions."))
              }
              className="justify-self-start"
            >
              <UploadCloudIcon aria-hidden /> Upload to my account
            </Button>
          </div>
        ) : null}

        {sync.mode === "foreign_data" ? (
          <div className="grid gap-3 rounded-card bg-warning-soft p-4 text-warning-ink">
            <p className="text-sm">
              Nothing has been mixed or overwritten. Open Account settings to sign in as the owner, or to clear this device and start fresh as{" "}
              {sync.email ?? "the current account"}.
            </p>
            <Button asChild variant="secondary" className="justify-self-start">
              <Link href="/settings/account" onClick={onClose}>
                Open Account settings
              </Link>
            </Button>
          </div>
        ) : null}

        {sync.mode === "signed_out" ? (
          <Button asChild variant="secondary" className="justify-self-start">
            <Link href="/login" onClick={onClose}>
              Sign in
            </Link>
          </Button>
        ) : null}
        {sync.mode === "device" ? (
          <Button asChild variant="secondary" className="justify-self-start">
            <Link href="/settings/account" onClick={onClose}>
              Account and sync
            </Link>
          </Button>
        ) : null}

        {items.length > 0 ? (
          <section aria-labelledby="attention-title" className="grid gap-3">
            <div>
              <h3 id="attention-title" className="font-display text-base font-semibold">
                Needs attention
              </h3>
              <p className="text-sm text-muted-foreground">
                These changes were saved here but not accepted. They stay until you retry or discard them; nothing was overwritten.
              </p>
            </div>
            <ul className="grid gap-3">
              {items.map((item) => (
                <li key={item.id} className="grid gap-3 rounded-card border border-border bg-card p-4">
                  <p className="text-sm font-medium">{item.sentence}</p>
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer rounded-sm focus-ring">Details</summary>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                      {item.evidence.map((e) => (
                        <div key={e.label} className="contents">
                          <dt>{e.label}</dt>
                          <dd className="font-mono break-all text-foreground">{e.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => void act(`retry:${item.id}`, () => store.retry(item.id), "Couldn't retry. Try again.")}>
                      <RotateCwIcon aria-hidden /> Retry
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy !== null}
                      className="text-danger-ink"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Discard this change?",
                          description: discardConsequence(item),
                          confirmLabel: "Discard",
                          destructive: true,
                        });
                        if (ok) void act(`discard:${item.id}`, () => store.discard(item.id), "Couldn't discard it. Try again.");
                      }}
                    >
                      <Trash2Icon aria-hidden /> Discard
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </SheetBody>
      {info.canSync ? (
        <SheetFooter>
          <Button
            size="lg"
            disabled={busy !== null || sync.phase === "syncing"}
            onClick={() => void act("sync", () => store.syncNow(), "Couldn't sync. Try again in a moment.")}
          >
            <RefreshCwIcon className={sync.phase === "syncing" ? "motion-safe:animate-spin" : undefined} aria-hidden /> Sync now
          </Button>
        </SheetFooter>
      ) : null}
    </>
  );
}
