"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate, formatDuration, zoneAbbreviation } from "@/lib/format";
import { rezoneChanges, rezonePreview } from "@/lib/sessions/rezone";
import type { ShiftSession } from "@/lib/shifts/types";
import { useNow, useShiftStore } from "@/lib/store/react";
import { cn } from "@/lib/utils";

import { actionMessage } from "./errors";
import { ZoneSelect } from "./zone-select";

/**
 * Change the timezone a session's days are split in, with a preview of how its day contributions move
 * before confirming. The instants never change. Sent against the revision that was previewed.
 */
export function RezoneSheet({ open, onOpenChange, session, suggested }: { open: boolean; onOpenChange: (open: boolean) => void; session: ShiftSession; suggested: string[] }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent onOpenAutoFocus={(e) => e.preventDefault()}>{open ? <RezoneForm session={session} suggested={suggested} onDone={() => onOpenChange(false)} /> : null}</SheetContent>
    </Sheet>
  );
}

function RezoneForm({ session, suggested, onDone }: { session: ShiftSession; suggested: string[]; onDone: () => void }) {
  const store = useShiftStore();
  const now = useNow(60_000);
  const [zone, setZone] = useState(session.reportingTimeZone);
  const [revision] = useState(session.revision);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const rows = useMemo(() => rezonePreview(session, zone, now), [session, zone, now]);
  const same = zone === session.reportingTimeZone;
  const moves = rezoneChanges(rows);
  const total = rows.reduce((s, r) => s + r.afterMs, 0);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await store.rezone(session.id, zone, revision);
      toast.success(`Days now split in ${zone}`);
      onDone();
    } catch (e) {
      setError(actionMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>Reporting timezone</SheetTitle>
        <SheetDescription>Decides where this session&apos;s midnights fall in reports. The times themselves don&apos;t change.</SheetDescription>
      </SheetHeader>
      <SheetBody className="grid content-start gap-5">
        <Field label="Split days in" htmlFor="rezone-zone" hint={`Now: ${session.reportingTimeZone} (${zoneAbbreviation(session.startedAt, session.reportingTimeZone)})`}>
          <ZoneSelect id="rezone-zone" value={zone} onChange={setZone} suggested={suggested} aria-describedby="rezone-zone-hint" />
        </Field>
        <div className="grid gap-2">
          <p className="text-sm font-medium">Day contributions</p>
          <table className="w-full text-sm tabular">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1.5 font-medium">Date</th>
                <th className="py-1.5 text-right font-medium">Now</th>
                <th className="py-1.5 text-right font-medium">{same ? "After" : zoneAbbreviation(session.startedAt, zone)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.date}>
                  <td className="py-2">{formatDate(r.date)}</td>
                  <td className="py-2 text-right text-muted-foreground">{r.beforeMs ? formatDuration(r.beforeMs) : "—"}</td>
                  <td className={cn("py-2 text-right font-medium", r.afterMs !== r.beforeMs && "text-brand")}>{r.afterMs ? formatDuration(r.afterMs) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border-strong">
                <td className="pt-2 text-muted-foreground">Total</td>
                <td className="pt-2 text-right text-muted-foreground">{formatDuration(total)}</td>
                <td className="pt-2 text-right font-semibold">{formatDuration(total)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="text-xs text-muted-foreground">
            {same ? "Pick another timezone to see the difference." : moves ? "Highlighted days change. Insights and rewards update to match." : "The days don't change for this session."}
          </p>
        </div>
        {error ? (
          <p role="alert" className="rounded-control bg-danger-soft p-3 text-sm font-medium text-danger-ink">
            {error}
          </p>
        ) : null}
      </SheetBody>
      <SheetFooter>
        <Button variant="secondary" size="lg" onClick={onDone}>
          Cancel
        </Button>
        <Button size="lg" disabled={same || saving} onClick={save}>
          {saving ? "Saving…" : "Use this timezone"}
        </Button>
      </SheetFooter>
    </>
  );
}
