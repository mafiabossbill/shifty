"use client";

import Link from "next/link";
import { memo, useMemo } from "react";

import { formatDate, formatDuration, spokenDuration, zoneAbbreviation, type ClockFormat } from "@/lib/format";
import { daySplit } from "@/lib/sessions/geometry";
import type { SessionRow } from "@/lib/sessions/rows";
import { formatRange } from "@/lib/sessions/wording";
import type { SessionSyncState, SyncMode } from "@/lib/store/store";
import type { DayAllocation } from "@/lib/time/allocate";
import { cn } from "@/lib/utils";

import { ProjectDot, SessionBadges } from "./badges";
import { DaySplitBar } from "./day-split-bar";

export interface SessionRowProps {
  row: SessionRow;
  now: number;
  clock: ClockFormat;
  deviceZone: string;
  sync: SessionSyncState | undefined;
  mode: SyncMode;
  /** Length-sorted lists aren't grouped by date: show the start date on the row. */
  showDate?: boolean;
  /** `?date=` drill-down: this session's contribution to that date. */
  contribution?: DayAllocation | null;
}

export function sessionHref(id: string) {
  return `/sessions/view?id=${encodeURIComponent(id)}`;
}

/**
 * A session in the list. Phones: a stacked card row (title + net, range, day-split band, badges).
 * ≥768px: one dense line — title and badges · range · band · breaks · net.
 */
export const SessionRowItem = memo(function SessionRowItem({ row, now, clock, deviceZone, sync, mode, showDate, contribution }: SessionRowProps) {
  const s = row.session;
  const running = s.endedAt === null;
  const split = useMemo(() => daySplit(s, now), [s, now]);
  const zone = s.reportingTimeZone;
  const zoneNote = zone !== deviceZone ? ` ${zoneAbbreviation(s.startedAt, zone)}` : "";
  const range = `${formatRange(s.startedAt, s.endedAt, zone, clock)}${zoneNote}`;
  const breakText = row.metrics.breakMs > 0 ? `${formatDuration(row.metrics.breakMs)} break` : "No breaks";
  const value = contribution ? contribution.netMs : row.metrics.netMs;
  const dateText = showDate || contribution ? formatDate(row.anchor) : null;

  return (
    <Link
      href={sessionHref(s.id)}
      prefetch={false}
      aria-label={`${row.title}, ${dateText ? `${dateText}, ` : ""}${range}, ${spokenDuration(value)} net${running ? ", running" : ""}`}
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors outline-none hover:bg-accent/50 focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        "md:grid-cols-[minmax(0,1fr)_10.5rem_minmax(7rem,13rem)_5.5rem_5.5rem] md:gap-y-1 md:px-5 md:py-3",
        s.archivedAt !== null && "opacity-75",
      )}
    >
      <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5">
        <ProjectDot color={row.project?.color} />
        <span className="truncate font-medium text-foreground">{row.title}</span>
        {row.project ? <span className="hidden truncate text-xs text-muted-foreground xl:inline">{row.project.name}</span> : null}
      </div>

      <div className="col-start-2 row-start-1 text-right md:col-start-5 md:row-span-2 md:self-center">
        <span className={cn("block font-display text-xl leading-none font-semibold tracking-tight tabular md:text-lg", running && "text-brand")}>{formatDuration(value)}</span>
        {contribution ? (
          <span className="mt-1 block text-2xs text-muted-foreground tabular">of {formatDuration(row.metrics.netMs)}</span>
        ) : (
          <span className="mt-1 block text-2xs text-muted-foreground md:hidden">net</span>
        )}
      </div>

      <p className="col-span-2 row-start-2 flex min-w-0 flex-wrap items-center gap-x-2 text-sm text-muted-foreground tabular md:col-span-1 md:col-start-2 md:row-span-2 md:row-start-1 md:grid md:gap-0 md:self-center md:text-[13px]">
        {dateText ? <span className="text-foreground/80 md:text-xs">{dateText}</span> : null}
        <span className="whitespace-nowrap text-foreground/90">{range}</span>
        <span className="md:hidden" aria-hidden>
          ·
        </span>
        <span className="md:hidden">{breakText}</span>
      </p>

      <DaySplitBar split={split} className="col-span-2 row-start-3 md:col-span-1 md:col-start-3 md:row-span-2 md:row-start-1 md:self-center" />

      <span className="hidden text-right text-[13px] text-muted-foreground tabular md:col-start-4 md:row-span-2 md:row-start-1 md:block md:self-center">
        {row.metrics.breakMs > 0 ? formatDuration(row.metrics.breakMs) : "—"}
      </span>

      <SessionBadges row={row} sync={sync} mode={mode} className="col-span-2 row-start-4 empty:hidden md:col-span-1 md:col-start-1 md:row-start-2" />
    </Link>
  );
});
