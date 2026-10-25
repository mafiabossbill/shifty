"use client";

import { RotateCcwIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { zoneAbbreviation, type ClockFormat } from "@/lib/format";
import { checkCorrection, draftFromSession, longSessionWarning, reasonProblem, resolveDraft, type TimesDraft } from "@/lib/sessions/draft";
import { timeSnapshot } from "@/lib/shifts/reducer";
import type { ShiftSession, ShiftState } from "@/lib/shifts/types";
import { useNow, useShiftStore } from "@/lib/store/react";
import { deviceTimeZone } from "@/lib/time/zone";

import { actionMessage, isRevisionMismatch } from "./errors";
import { TimesFields, TimesPreview, VerdictNotice } from "./times-form";

/**
 * Edit times: start, end (finished sessions) and breaks, with a required reason, a live preview and the
 * reducer's own verdict before anything is saved. Saved as a correction against the revision that was
 * open, so a change made elsewhere meanwhile is never overwritten.
 */
export function EditTimesSheet({
  open,
  onOpenChange,
  session,
  state,
  clock,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ShiftSession;
  state: ShiftState;
  clock: ClockFormat;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent onOpenAutoFocus={(e) => e.preventDefault()} className="md:w-[520px]">
        {open ? <EditTimesForm session={session} state={state} clock={clock} onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function EditTimesForm({ session, state, clock, onDone }: { session: ShiftSession; state: ShiftState; clock: ClockFormat; onDone: () => void }) {
  const store = useShiftStore();
  const confirm = useConfirm();
  const now = useNow(30_000);
  const zone = session.reportingTimeZone;
  const running = session.endedAt === null;
  // The version this edit is made against: fixed when the sheet opens.
  const [base, setBase] = useState(() => ({ session, draft: draftFromSession(session, zone) }));
  const [draft, setDraft] = useState<TimesDraft>(base.draft);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<{ message: string; stale: boolean } | null>(null);

  const resolved = useMemo(() => resolveDraft(draft, zone, { running, original: base.session }), [draft, zone, running, base.session]);
  const snapshot = resolved.ok ? resolved.snapshot : null;
  const deviceZone = useMemo(() => deviceTimeZone(), []);
  const verdict = useMemo(
    () => (snapshot ? checkCorrection(state, { ...session, revision: base.session.revision }, snapshot, now, deviceZone) : null),
    [snapshot, state, session, base.session.revision, now, deviceZone],
  );
  const stale = session.revision !== base.session.revision;
  const reasonError = tried ? reasonProblem(reason) : null;
  const other = verdict?.status === "overlap" && verdict.conflictingSessionId ? (state.sessions[verdict.conflictingSessionId] ?? null) : null;

  const reload = () => {
    const next = { session, draft: draftFromSession(session, zone) };
    setBase(next);
    setDraft(next.draft);
    setFailure(null);
  };

  const submit = async (allowOverlap = false) => {
    setTried(true);
    if (!snapshot || reasonProblem(reason) || !verdict) return;
    if (verdict.status === "error" || verdict.status === "unchanged") return;
    if (verdict.status === "overlap" && !allowOverlap) return;
    if (allowOverlap) {
      const ok = await confirm({
        title: "Save times that overlap another session?",
        description: "Both sessions will count in your reports for the overlapping time. Only do this if you really worked both.",
        confirmLabel: "Save anyway",
      });
      if (!ok) return;
    }
    setSaving(true);
    setFailure(null);
    try {
      await store.correct(session.id, {
        reason: reason.trim(),
        expectedRevision: base.session.revision,
        startedAt: snapshot.startedAt,
        ...(running ? {} : { endedAt: snapshot.endedAt }),
        breaks: snapshot.breaks,
        ...(allowOverlap ? { allowOverlap: true } : {}),
      });
      toast.success("Times corrected", { description: "The change is in this session's history." });
      onDone();
    } catch (error) {
      setFailure({ message: actionMessage(error), stale: isRevisionMismatch(error) });
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!snapshot && verdict?.status === "ok" && !saving;

  return (
    <>
      <SheetHeader>
        <SheetTitle>Edit times</SheetTitle>
        <SheetDescription>
          Times are in {zone} ({zoneAbbreviation(session.startedAt, zone)}). The old values stay in the history.
        </SheetDescription>
      </SheetHeader>
      <SheetBody className="grid content-start gap-5">
        {stale || failure?.stale ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-control bg-warning-soft p-3 text-sm text-warning-ink">
            <p className="min-w-0 flex-1 font-medium">This session changed since you opened it. Review the latest version, then make your edit again.</p>
            <Button size="sm" variant="secondary" onClick={reload}>
              <RotateCcwIcon />
              Load latest
            </Button>
          </div>
        ) : null}
        <TimesFields idPrefix="edit" draft={draft} onChange={setDraft} zone={zone} running={running} problem={resolved.ok ? null : resolved} now={now} />
        <TimesPreview snapshot={snapshot} zone={zone} clock={clock} now={now} previous={timeSnapshot(base.session)} goalSeconds={session.goalSeconds} />
        {snapshot && longSessionWarning(snapshot) ? <p className="-mt-2 text-sm font-medium text-warning-ink">{longSessionWarning(snapshot)}</p> : null}
        {verdict && !stale ? <VerdictNotice verdict={verdict} other={other} clock={clock} /> : null}
        <Field label="Why are you changing it?" htmlFor="edit-reason" error={reasonError ?? undefined} hint="Required. For example: forgot to clock out.">
          <Textarea
            id="edit-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            className="min-h-16"
            aria-invalid={!!reasonError}
            aria-describedby={reasonError ? "edit-reason-error" : "edit-reason-hint"}
            required
          />
        </Field>
        {failure && !failure.stale ? (
          <p role="alert" className="rounded-control bg-danger-soft p-3 text-sm font-medium text-danger-ink">
            {failure.message}
          </p>
        ) : null}
      </SheetBody>
      <SheetFooter>
        <Button variant="secondary" size="lg" onClick={onDone}>
          Cancel
        </Button>
        {verdict?.status === "overlap" && !stale ? (
          <Button variant="outline" size="lg" disabled={saving} onClick={() => (reasonProblem(reason) ? setTried(true) : submit(true))}>
            Save anyway (overlap)
          </Button>
        ) : (
          <Button size="lg" disabled={!canSave || stale} onClick={() => submit(false)}>
            {saving ? "Saving…" : "Save correction"}
          </Button>
        )}
      </SheetFooter>
    </>
  );
}
