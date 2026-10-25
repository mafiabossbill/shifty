"use client";

import { PlusIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apportionMinutes, formatDate, formatDuration, zoneAbbreviation, type ClockFormat } from "@/lib/format";
import { suggestBreak, type BreakDraft, type FieldKey, type Resolved, type TimesDraft, type Verdict } from "@/lib/sessions/draft";
import { daySplit } from "@/lib/sessions/geometry";
import { displayTitle, placeOf } from "@/lib/sessions/rows";
import { BREAK_KIND_LABEL, describeChanges, formatRange } from "@/lib/sessions/wording";
import type { BreakKind, ShiftSession, TimeSnapshot } from "@/lib/shifts/types";
import { newUuid } from "@/lib/store/store";
import { anchorDate } from "@/lib/time/allocate";
import { fromWallClockInput } from "@/lib/time/zone";
import { cn } from "@/lib/utils";

import { DaySplitBar } from "./day-split-bar";
import { sessionHref } from "./session-row";

/**
 * Start, end and breaks as `datetime-local` fields read in `zone`. Used by Edit times and by Add missed
 * session. Errors point at the field they're about.
 */
export function TimesFields({
  idPrefix,
  draft,
  onChange,
  zone,
  running,
  problem,
  now,
}: {
  idPrefix: string;
  draft: TimesDraft;
  onChange: (next: TimesDraft) => void;
  zone: string;
  running: boolean;
  problem: Extract<Resolved, { ok: false }> | null;
  now: number;
}) {
  const err = (field: FieldKey) => (problem?.field === field ? problem.message : undefined);
  const setBreak = (id: string, patch: Partial<BreakDraft>) =>
    onChange({
      ...draft,
      breaks: draft.breaks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  const addBreak = () => {
    const start = fromWallClockInput(draft.start, zone);
    const end = running ? null : fromWallClockInput(draft.end, zone);
    if (start === null || (!running && end === null)) {
      onChange({
        ...draft,
        breaks: [...draft.breaks, { id: newUuid(), kind: "rest", start: draft.start, end: draft.start }],
      });
      return;
    }
    onChange({
      ...draft,
      breaks: [...draft.breaks, suggestBreak({ startedAt: start, endedAt: end }, now, zone, newUuid())],
    });
  };
  const sid = `${idPrefix}-start`;
  const eid = `${idPrefix}-end`;
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start" htmlFor={sid} error={err("start")} className="content-start">
          <Input
            id={sid}
            type="datetime-local"
            value={draft.start}
            onChange={(e) => onChange({ ...draft, start: e.target.value })}
            aria-invalid={!!err("start")}
            aria-describedby={err("start") ? `${sid}-error` : undefined}
            required
          />
        </Field>
        {running ? (
          <div className="grid content-start gap-2">
            <span className="text-sm font-medium">End</span>
            <p className="flex h-11 items-center rounded-control bg-raised px-3.5 text-sm text-muted-foreground md:h-10">
              Still running — use Clock out to finish
            </p>
          </div>
        ) : (
          <Field label="End" htmlFor={eid} error={err("end")} hint="Can be the next day" className="content-start">
            <Input
              id={eid}
              type="datetime-local"
              value={draft.end}
              onChange={(e) => onChange({ ...draft, end: e.target.value })}
              aria-invalid={!!err("end")}
              aria-describedby={err("end") ? `${eid}-error` : `${eid}-hint`}
              required
            />
          </Field>
        )}
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-2 flex w-full items-center justify-between gap-3 text-sm font-medium">
          Breaks
          <span className="text-xs font-normal text-muted-foreground">
            {draft.breaks.length ? `${draft.breaks.length} break${draft.breaks.length === 1 ? "" : "s"}` : "None"}
          </span>
        </legend>
        {draft.breaks.map((b, i) => {
          const bs = `${idPrefix}-b${i}-start`;
          const be = `${idPrefix}-b${i}-end`;
          const startErr = err(`break:${b.id}:start`);
          const endErr = err(`break:${b.id}:end`);
          const open = running && b.end === "" && b.original?.endedAt === null;
          return (
            <div key={b.id} className="grid gap-3 rounded-control border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="w-32">
                  <span className="sr-only">Break {i + 1} kind</span>
                  <Select value={b.kind} onChange={(e) => setBreak(b.id, { kind: e.target.value as BreakKind })}>
                    {(Object.keys(BREAK_KIND_LABEL) as BreakKind[]).map((k) => (
                      <option key={k} value={k}>
                        {BREAK_KIND_LABEL[k]}
                      </option>
                    ))}
                  </Select>
                </label>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove break ${i + 1}`}
                  onClick={() =>
                    onChange({
                      ...draft,
                      breaks: draft.breaks.filter((x) => x.id !== b.id),
                    })
                  }
                >
                  <XIcon />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="From" htmlFor={bs} error={startErr} className="content-start">
                  <Input id={bs} type="datetime-local" value={b.start} onChange={(e) => setBreak(b.id, { start: e.target.value })} aria-invalid={!!startErr} />
                </Field>
                {open ? (
                  <div className="grid content-start gap-2">
                    <span className="text-sm font-medium">To</span>
                    <p className="flex h-11 items-center rounded-control bg-raised px-3.5 text-sm text-muted-foreground md:h-10">On break now</p>
                  </div>
                ) : (
                  <Field label="To" htmlFor={be} error={endErr} className="content-start">
                    <Input id={be} type="datetime-local" value={b.end} onChange={(e) => setBreak(b.id, { end: e.target.value })} aria-invalid={!!endErr} />
                  </Field>
                )}
              </div>
            </div>
          );
        })}
        <Button variant="secondary" size="sm" className="justify-self-start" onClick={addBreak}>
          <PlusIcon />
          Add a break
        </Button>
      </fieldset>
    </div>
  );
}

/** What the session would look like: net, elapsed, breaks, the day split, and (for edits) what changed. */
export function TimesPreview({
  snapshot,
  zone,
  clock,
  now,
  previous,
  goalSeconds,
}: {
  snapshot: TimeSnapshot | null;
  zone: string;
  clock: ClockFormat;
  now: number;
  previous?: TimeSnapshot;
  goalSeconds: number;
}) {
  const split = useMemo(() => (snapshot ? daySplit({ ...snapshot, reportingTimeZone: zone }, now) : null), [snapshot, zone, now]);
  if (!snapshot || !split || split.totalMs <= 0) {
    return <p className="rounded-control bg-raised p-4 text-sm text-muted-foreground">The preview appears once the start and end make sense.</p>;
  }
  const netMs = split.days.reduce((s, d) => s + d.netMs, 0);
  const breakMs = split.days.reduce((s, d) => s + d.breakMs, 0);
  const minutes = apportionMinutes(split.days.map((d) => d.netMs));
  const changes = previous ? describeChanges(previous, snapshot, zone, clock) : [];
  return (
    <div className="grid gap-3 rounded-control bg-raised p-4" aria-live="polite">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="type-eyebrow text-muted-foreground">Net</p>
          <p className="type-stat">{formatDuration(netMs)}</p>
        </div>
        <p className="text-sm text-muted-foreground tabular">
          {formatRange(snapshot.startedAt, snapshot.endedAt, zone, clock)} · {formatDuration(split.totalMs)} elapsed ·{" "}
          {breakMs ? `${formatDuration(breakMs)} break` : "no breaks"}
        </p>
      </div>
      <DaySplitBar split={split} className="h-2.5 [&_span.bg-card]:bg-raised" />
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular">
        {split.days.map((d, i) => (
          <li key={d.date}>
            <span className="text-muted-foreground">{formatDate(d.date)}</span> <span className="font-medium">{formatDuration(minutes[i] * 60_000)}</span>
          </li>
        ))}
        {split.days.length > 1 ? <li className="font-medium">= {formatDuration(netMs)}</li> : null}
      </ul>
      {goalSeconds * 1000 < netMs ? (
        <p className="text-xs text-muted-foreground">
          +{formatDuration(netMs - goalSeconds * 1000)} past the {formatDuration(goalSeconds * 1000)} goal
        </p>
      ) : null}
      {previous ? (
        <div className="grid gap-1 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground">What changes</p>
          {changes.length ? (
            <ul className="grid gap-1 text-sm tabular">
              {changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing yet — change a time above.</p>
          )}
        </div>
      ) : null}
      <p className="text-2xs text-muted-foreground">
        Times in {zone} ({zoneAbbreviation(snapshot.startedAt, zone)}).
      </p>
    </div>
  );
}

/** The reducer's answer, in place: an error to fix, or an overlap that can be saved on purpose. */
export function VerdictNotice({ verdict, other, clock }: { verdict: Verdict; other: ShiftSession | null; clock: ClockFormat }) {
  if (verdict.status === "ok" || verdict.status === "unchanged") return null;
  const overlap = verdict.status === "overlap";
  return (
    <div role="alert" className={cn("flex gap-3 rounded-control p-3 text-sm", overlap ? "bg-warning-soft text-warning-ink" : "bg-danger-soft text-danger-ink")}>
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="grid gap-1">
        <p className="font-medium">{verdict.message}</p>
        {overlap && other ? (
          <p>
            It overlaps{" "}
            <Link href={sessionHref(other.id)} className="font-medium underline underline-offset-4" target="_blank">
              {displayTitle(other, placeOf(other))}, {formatDate(anchorDate(other))}
            </Link>{" "}
            ({formatRange(other.startedAt, other.endedAt, other.reportingTimeZone, clock)}
            ). Fix the times, or save anyway if both really happened.
          </p>
        ) : null}
      </div>
    </div>
  );
}
