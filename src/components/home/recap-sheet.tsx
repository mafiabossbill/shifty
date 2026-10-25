"use client";

import { useEffect, useId, useState } from "react";
import { SparklesIcon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration, formatInstant, formatTime, zoneAbbreviation, type ClockFormat } from "@/lib/format";
import { daySplitLine, overageLine, undoSecondsLeft } from "@/lib/home/view-model";
import type { SessionRewardSummary } from "@/lib/rewards/types";
import type { Companion } from "@/lib/shifts/profile";
import type { ShiftSession } from "@/lib/shifts/types";
import { ShiftActionError } from "@/lib/store/store";
import { allocateByDay, sessionMetrics } from "@/lib/time/allocate";
import { localDateOf } from "@/lib/time/zone";
import { cn } from "@/lib/utils";

import { CompanionMochi } from "./shared";

export interface RecapSheetProps {
  session: ShiftSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  now: number;
  clock: ClockFormat;
  companion: Companion;
  summary: SessionRewardSummary | null;
  /** The clock-out can still be undone until this instant. */
  undoUntil: number | null;
  onUndo: () => Promise<boolean>;
  onSave: (changes: { mood: number | null; energy: number | null; notes: string }) => Promise<void>;
}

/** Shown the moment the person clocks out: what was logged, XP, Mochi, optional mood/energy/note, and Undo. */
export function RecapSheet({ session, open, onOpenChange, now, clock, companion, summary, undoUntil, onUndo, onSave }: RecapSheetProps) {
  return (
    <Sheet open={open && session !== null} onOpenChange={onOpenChange}>
      <SheetContent onOpenAutoFocus={(e) => e.preventDefault()} className="md:w-[460px]">
        {session ? (
          <RecapBody
            key={session.id}
            session={session}
            now={now}
            clock={clock}
            companion={companion}
            summary={summary}
            undoUntil={undoUntil}
            onUndo={onUndo}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function RecapBody({
  session,
  now,
  clock,
  companion,
  summary,
  undoUntil,
  onUndo,
  onSave,
  onClose,
}: Omit<RecapSheetProps, "open" | "onOpenChange" | "session"> & {
  session: ShiftSession;
  onClose: () => void;
}) {
  const id = useId();
  const [mood, setMood] = useState<number | null>(session.mood);
  const [energy, setEnergy] = useState<number | null>(session.energy);
  const [notes, setNotes] = useState(session.notes);
  const [saving, setSaving] = useState(false);
  const [celebrate, setCelebrate] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setCelebrate(false), 2600);
    return () => clearTimeout(t);
  }, []);

  const zone = session.reportingTimeZone;
  const m = sessionMetrics(session, now);
  const days = allocateByDay(session, now, m);
  const split = daySplitLine(days);
  const over = overageLine(m.netMs, session.goalSeconds);
  const undoLeft = undoUntil !== null ? undoSecondsLeft(undoUntil, now) : 0;
  const achievements = summary?.achievements ?? [];
  const mochiMood = over ? "resting" : celebrate || achievements.length > 0 ? "celebrating" : "proud";
  const end = session.endedAt ?? now;
  const dirty = mood !== session.mood || energy !== session.energy || notes.trim() !== session.notes.trim();

  const done = async () => {
    if (!dirty) return onClose();
    setSaving(true);
    try {
      await onSave({ mood, energy, notes: notes.trim() });
      onClose();
    } catch (error) {
      toast.error(error instanceof ShiftActionError ? error.message : "Couldn't save the note. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SheetHeader className="items-center pr-5 text-center md:pr-14">
        <CompanionMochi companion={companion} mood={mochiMood} size={84} />
        <SheetTitle>Shift logged</SheetTitle>
        <SheetDescription>
          {formatInstant(session.startedAt, zone, clock)} → {localDateOf(end, zone) === localDateOf(session.startedAt, zone) ? formatTime(end, zone, clock) : formatInstant(end, zone, clock)}{" "}
          {zoneAbbreviation(end, zone)}
        </SheetDescription>
      </SheetHeader>
      <SheetBody className="grid content-start gap-5">
        <div className="grid justify-items-center gap-1 text-center">
          <span className="type-eyebrow text-muted-foreground">Net worked</span>
          <span className="type-display tabular">{formatDuration(m.netMs)}</span>
          {over ? <p className="text-sm text-muted-foreground">{over}</p> : null}
        </div>

        <dl className="grid grid-cols-3 gap-2">
          <Mini label="Elapsed" value={formatDuration(m.elapsedMs)} />
          <Mini label="Breaks" value={formatDuration(m.breakMs)} />
          <Mini label={days.length === 1 ? "Day" : "Days"} value={String(days.length)} />
        </dl>
        {days.length > 1 ? (
          <p className="-mt-2 text-center text-sm text-muted-foreground">
            <span className="sr-only">Per day: </span>
            {split}
          </p>
        ) : null}

        {summary ? (
          <section aria-labelledby={`${id}-xp`} className="grid gap-2 rounded-card bg-raised p-4">
            <div className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-celebrate" aria-hidden />
              <h3 id={`${id}-xp`} className="font-display text-base font-semibold">
                +{summary.xp} XP
              </h3>
            </div>
            {summary.lines.length > 0 ? (
              <ul className="grid gap-1 text-sm">
                {summary.lines.map((l) => (
                  <li key={l.key} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{l.label}</span>
                    <span className="tabular font-medium">+{l.xp}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {summary.notes.map((n) => (
              <p key={n} className="text-xs text-muted-foreground">
                {n}
              </p>
            ))}
            {achievements.map((a) => (
              <div key={a.code} className="mt-1 grid gap-0.5 rounded-control bg-celebrate-soft px-3 py-2">
                <p className="text-sm font-semibold text-celebrate-ink">New: {a.name}</p>
                <p className="text-xs text-celebrate-ink/90">{a.description}</p>
              </div>
            ))}
          </section>
        ) : null}

        <Scale id={`${id}-mood`} label="How did it feel?" low="Rough" high="Great" value={mood} onChange={setMood} />
        <Scale id={`${id}-energy`} label="Energy left" low="Empty" high="Plenty" value={energy} onChange={setEnergy} />
        <Field label="Note" htmlFor={`${id}-note`} optional>
          <Textarea
            id={`${id}-note`}
            value={notes}
            maxLength={4000}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-20"
            placeholder="Anything to remember about this shift"
          />
        </Field>
      </SheetBody>
      <SheetFooter>
        {undoLeft > 0 ? (
          <Button
            variant="secondary"
            size="lg"
            onClick={async () => {
              const undone = await onUndo();
              if (!undone) toast.error("It's too late to undo. You can edit the end time in Sessions.");
            }}
          >
            <Undo2Icon aria-hidden /> Undo clock-out <span className="tabular text-muted-foreground">({undoLeft})</span>
          </Button>
        ) : null}
        <Button size="lg" onClick={done} disabled={saving}>
          {dirty ? "Save and close" : "Done"}
        </Button>
      </SheetFooter>
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 rounded-control bg-raised px-3 py-2.5 text-center">
      <dt className="type-eyebrow text-muted-foreground">{label}</dt>
      <dd className="font-display text-lg font-semibold tabular">{value}</dd>
    </div>
  );
}

/** 1–5 tap scale (radio group semantics with plain buttons; tap again to clear). */
function Scale({
  id,
  label,
  low,
  high,
  value,
  onChange,
}: {
  id: string;
  label: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div role="group" aria-labelledby={id} className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span id={id} className="text-sm font-medium">
          {label}
        </span>
        <span className="text-xs text-muted-foreground">Optional</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={`${n} of 5${n === 1 ? `, ${low}` : n === 5 ? `, ${high}` : ""}`}
            onClick={() => onChange(value === n ? null : n)}
            className={cn(
              "h-11 cursor-pointer rounded-control border border-border bg-raised font-display text-base font-semibold tabular transition-colors focus-ring",
              "hover:border-border-strong",
              value === n && "border-brand bg-brand-soft text-brand-strong",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-2xs text-muted-foreground" aria-hidden>
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}
