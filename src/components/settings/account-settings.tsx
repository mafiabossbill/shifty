"use client";

import * as React from "react";
import Link from "next/link";
import { CloudIcon, CloudOffIcon, HardDriveIcon, LogOutIcon, RefreshCwIcon, UploadCloudIcon } from "lucide-react";
import { toast } from "sonner";

import { AccountData } from "@/components/account/account-data";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { signOut } from "@/lib/auth-actions";
import { formatInstant } from "@/lib/format";
import { supabaseConfigured } from "@/lib/supabase/env";
import type { StoreView } from "@/lib/store/store";
import { useShiftStore } from "@/lib/store/react";

import { SettingsGroup, SettingsHeader, SettingsSkeleton } from "./parts";
import { useReadyShift } from "./use-ready-shift";

type Persisted = "persisted" | "best-effort" | "unknown";

function usePersistedStorage(): Persisted | null {
  const [state, setState] = React.useState<Persisted | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    const read = async () => {
      try {
        if (!navigator.storage?.persisted) return "unknown" as const;
        return (await navigator.storage.persisted()) ? ("persisted" as const) : ("best-effort" as const);
      } catch {
        return "unknown" as const;
      }
    };
    void read().then((v) => !cancelled && setState(v));
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function AccountSettings() {
  const view = useReadyShift();
  const store = useShiftStore();
  const confirm = useConfirm();
  const persisted = usePersistedStorage();
  const [erasing, setErasing] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  if (!view.ready) return <SettingsSkeleton rows={4} />;
  const { sync } = view;
  const configured = sync.mode !== "unconfigured" && supabaseConfigured();
  const signedIn = Boolean(sync.email) && (sync.mode === "account" || sync.mode === "attach_pending" || sync.mode === "foreign_data");

  async function doSignOut() {
    const pending = view.sync.pending;
    const ok = await confirm({
      title: "Sign out of SHIFTY?",
      description:
        pending > 0
          ? `${plural(pending, "change")} haven't synced yet — they'll be lost. Sync first if you can. Signing out also clears this device.`
          : "Your synced data stays on your account. This device is cleared, so the next person can't see it.",
      confirmLabel: pending > 0 ? "Sign out and lose changes" : "Sign out",
      destructive: pending > 0,
    });
    if (!ok) return;
    setSigningOut(true);
    try {
      await store.wipeDevice();
      await signOut(); // redirects to /login
    } catch (e) {
      // redirect() surfaces as a thrown navigation in some runtimes; anything else is a real failure.
      const message = (e as Error).message ?? "";
      if (!/NEXT_REDIRECT/.test(message)) toast.error(message || "Couldn't sign out. Check your connection and try again.");
    } finally {
      setSigningOut(false);
    }
  }

  async function attach() {
    try {
      await store.attachToAccount();
      toast.success("This device's data is uploading to your account.");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't upload this device's data. Try again.");
    }
  }

  return (
    <div className="grid gap-8">
      <SettingsHeader title="Account" description="Where your data lives, and syncing between devices." />

      <SettingsGroup title="On this device" id="device">
        <div className="flex gap-3 py-4">
          <HardDriveIcon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <div className="grid gap-1 text-sm">
            <p className="font-medium">{view.demo ? "Demo data lives in memory only. Nothing is saved or synced." : sync.mode === "account" ? "Saved on this device and synced to your account." : "Your data is saved on this device only."}</p>
            <p className="text-muted-foreground">
              It works offline and survives closing the app.{" "}
              {persisted === "persisted"
                ? "This browser has agreed to keep it even when storage runs low."
                : persisted === "best-effort"
                  ? "This browser may clear it if the device runs very low on storage — export a backup now and then, or sync to an account."
                  : persisted === "unknown"
                    ? "This browser doesn't say whether it keeps storage under pressure — export a backup now and then."
                    : ""}
            </p>
            <p className="text-muted-foreground tabular">
              {plural(view.sessions.length, "session")} here
              {sync.pending > 0 && sync.mode !== "device" && sync.mode !== "unconfigured" ? ` · ${plural(sync.pending, "change")} waiting to sync` : ""}.
            </p>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Sync" id="sync">
        <div className="grid gap-4 py-4">
          <SyncState view={view} configured={configured} />
          <div className="flex flex-wrap gap-2">
            {view.demo ? null : !configured ? null : signedIn ? (
              <>
                {sync.mode === "attach_pending" ? (
                  <Button onClick={() => void attach()}>
                    <UploadCloudIcon />
                    Upload this device&apos;s data
                  </Button>
                ) : null}
                {sync.mode === "account" ? (
                  <Button variant="secondary" disabled={sync.phase === "syncing"} onClick={() => void store.syncNow()}>
                    <RefreshCwIcon />
                    {sync.phase === "syncing" ? "Syncing…" : "Sync now"}
                  </Button>
                ) : null}
                <Button variant="outline" disabled={signingOut} onClick={() => void doSignOut()}>
                  <LogOutIcon />
                  {signingOut ? "Signing out…" : "Sign out"}
                </Button>
              </>
            ) : (
              <>
                <Button asChild>
                  <Link href="/login?next=/settings/account">Sign in</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/signup">Create account</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </SettingsGroup>

      {signedIn && sync.email && !view.demo ? (
        <section className="grid gap-3">
          <h2 className="px-1 font-display text-base font-semibold tracking-tight">Your account data</h2>
          <AccountData email={sync.email} />
        </section>
      ) : null}

      <SettingsGroup title="Erase this device" id="erase">
        <div className="grid gap-3 py-4">
          <p className="text-sm text-muted-foreground">
            Removes every session, setting and Mochi&apos;s progress from this browser.{" "}
            {sync.mode === "account" ? "Anything already synced stays on your account." : "Without an account, this can't be undone — export a backup first."}
          </p>
          <Button variant="danger" className="w-fit" onClick={() => setErasing(true)} disabled={view.demo}>
            Erase this device
          </Button>
          {view.demo ? <p className="text-xs text-muted-foreground">Exit demo first: demo data disappears on its own.</p> : null}
        </div>
      </SettingsGroup>

      <EraseDialog open={erasing} onOpenChange={setErasing} pending={sync.mode === "device" || sync.mode === "unconfigured" ? 0 : sync.pending} />
    </div>
  );
}

function SyncState({ view, configured }: { view: StoreView; configured: boolean }) {
  const { sync } = view;
  const zone = view.profile.settings.reportingTimeZone;
  const line = (icon: React.ReactNode, title: string, body?: React.ReactNode) => (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-brand [&_svg]:size-5" aria-hidden>
        {icon}
      </span>
      <div className="grid gap-1 text-sm">
        <p className="font-medium">{title}</p>
        {body ? <div className="text-muted-foreground">{body}</div> : null}
      </div>
    </div>
  );
  if (view.demo) return line(<CloudOffIcon />, "Sync is off in demo mode.");
  if (!configured) return line(<CloudOffIcon />, "Sync isn't set up on this deployment.", "Everything stays on this device. Export a backup to move it elsewhere.");
  switch (sync.mode) {
    case "account":
      return line(
        <CloudIcon />,
        `Signed in as ${sync.email ?? "your account"}`,
        <>
          {sync.lastSyncedAt ? `Last synced ${formatInstant(sync.lastSyncedAt, zone, view.profile.settings.clock)}.` : "Not synced yet."}
          {sync.message ? <p role="status">{sync.message}</p> : null}
        </>,
      );
    case "attach_pending":
      return line(
        <UploadCloudIcon />,
        `Signed in as ${sync.email ?? "your account"}`,
        "This device has data that isn't on your account yet. Upload it to keep it in sync — nothing on your account is overwritten.",
      );
    case "foreign_data":
      return line(
        <CloudOffIcon />,
        `Signed in as ${sync.email ?? "another account"}`,
        "This device holds another account's data, so it isn't syncing. Sign out to keep it, or erase this device to start fresh with this account.",
      );
    case "signed_out":
      return line(<CloudOffIcon />, "Signed out", sync.message ?? "Sign in again to sync. Your changes are safe on this device.");
    default:
      return line(<CloudOffIcon />, "Not signed in", "Sign in to back up your sessions and use SHIFTY on more than one device. What's on this device comes with you.");
  }
}

function EraseDialog({ open, onOpenChange, pending }: { open: boolean; onOpenChange: (open: boolean) => void; pending: number }) {
  const store = useShiftStore();
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const ready = typed.trim() === "ERASE";
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setTyped("");
      }}
    >
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!ready) return;
            setBusy(true);
            try {
              await store.wipeDevice();
              toast.success("This device is erased.");
              onOpenChange(false);
              setTyped("");
            } catch (err) {
              toast.error((err as Error).message || "Couldn't erase this device. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Erase this device?</DialogTitle>
            <DialogDescription>
              {pending > 0 ? `${plural(pending, "change")} haven't synced yet and will be lost. ` : ""}Type ERASE to confirm.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="erase-confirm" className="sr-only">
            Type ERASE to confirm
          </label>
          <Input id="erase-confirm" value={typed} autoComplete="off" autoCapitalize="characters" placeholder="ERASE" onChange={(e) => setTyped(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={!ready || busy}>
              {busy ? "Erasing…" : "Erase everything here"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
