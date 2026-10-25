"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api-client";
import type { DeletionImpact } from "@/lib/data/account";

export function AccountData({ email }: { email: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <section className="grid gap-2 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Download your data</h2>
        <p className="text-muted-foreground">Your account details, workspaces and the records you created, as a JSON file.</p>
        <Button asChild variant="outline" className="w-fit">
          <a href="/api/account/export" download>
            <DownloadIcon aria-hidden />
            Download my data
          </a>
        </Button>
      </section>
      <section className="grid gap-2 rounded-lg border border-red-200 p-4 dark:border-red-900/60">
        <h2 className="text-sm font-medium">Delete your account</h2>
        <p className="text-muted-foreground">
          Removes your account and sign-in for good. Records you created in shared workspaces stay, without your name.
        </p>
        <Button variant="destructive" className="w-fit" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      </section>
      <DeleteAccountDialog email={email} open={open} onOpenChange={setOpen} />
    </>
  );
}

function DeleteAccountDialog({ email, open, onOpenChange }: { email: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [impact, setImpact] = React.useState<DeletionImpact[] | null>(null);
  const [typed, setTyped] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    api
      .accountDeletionImpact()
      .then((rows) => live && setImpact(rows))
      .catch((err: unknown) => live && setError(err instanceof ApiError ? err.message : "Couldn't check your workspaces."));
    return () => {
      live = false;
    };
  }, [open]);

  const blocked = impact?.filter((w) => w.outcome === "blocked") ?? [];
  const deleted = impact?.filter((w) => w.outcome === "deleted") ?? [];
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await api.deleteAccount(typed);
      // The server signed the session out; refresh drops every cached view of it.
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete your account. Try again.");
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setTyped("");
          setError(null);
          setImpact(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>This can&apos;t be undone. Download your data first if you want a copy.</DialogDescription>
        </DialogHeader>
        {impact === null && !error ? <p className="text-muted-foreground">Checking your workspaces…</p> : null}
        {blocked.length > 0 ? (
          <p role="alert" className="text-[13px] text-red-700">
            You&apos;re the last admin of {blocked.map((w) => w.organization_name).join(", ")}. Make someone else an admin there
            first (Settings → Team).
          </p>
        ) : null}
        {deleted.length > 0 ? (
          <p className="text-[13px]">
            You&apos;re the only member of <strong>{deleted.map((w) => w.organization_name).join(", ")}</strong>, so{" "}
            {deleted.length === 1 ? "that workspace and everything in it is" : "those workspaces and everything in them are"} deleted
            too.
          </p>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor="confirm-email">Type {email} to confirm</Label>
          <Input
            id="confirm-email"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        {error ? (
          <p role="alert" className="text-[13px] text-red-700">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={!matches || pending || impact === null || blocked.length > 0}>
            {pending ? "Deleting…" : "Delete my account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
