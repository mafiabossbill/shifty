"use client";

/**
 * E. Month calendar: net hours per date, tinted by level. A small ring marks dates whose time comes
 * (partly) from a shift that started the day before; the day's popover links back to that shift
 * ("from Mon 26 Oct 18:00"). Cells are real buttons: tap, click or keyboard.
 */
import * as React from "react";
import Link from "next/link";

import { formatDate, formatDuration, formatMonth, formatTime, hours, type ClockFormat } from "@/lib/format";
import { durationsByRow, sessionHref, sessionsHref } from "@/lib/insights/labels";
import type { CalendarModel } from "@/lib/insights/model";
import type { AllocationMode, SessionFacts } from "@/lib/reports";
import type { LocalDate } from "@/lib/time/zone";
import { cn } from "@/lib/utils";

import { rowTitle } from "./day-ribbon";
import { ChartCard, ChartTip, DataTable, DrillLink, useChartInteraction, useElementWidth } from "./chart-kit";

const CELL_BG = ["", "bg-brand/10", "bg-brand/20", "bg-brand/30", "bg-brand/45"] as const;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthCalendar({
  calendar,
  facts,
  mode,
  clock,
  today,
  className,
}: {
  calendar: CalendarModel;
  facts: readonly SessionFacts[];
  mode: AllocationMode;
  clock: ClockFormat;
  today: LocalDate;
  className?: string;
}) {
  const cells = calendar.weeks.flat();
  const {
    container: { ref: gridRef },
    ...ix
  } = useChartInteraction(cells.length, { columns: 7, skip: (i) => !cells[i].inMonth });
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const byId = React.useMemo(() => new Map(facts.map((f) => [f.session.id, f])), [facts]);
  const active = ix.active !== null ? cells[ix.active] : null;
  const thisYear = today.slice(0, 4);
  const colW = width / 7;
  const rowH = width < 480 ? 54 : 60;
  const monthCells = cells.filter((c) => c.inMonth);
  const anyEarlier = monthCells.some((c) => c.startedEarlier);
  const netText = durationsByRow(monthCells, (c) => c.date, (c) => c.netMs);

  return (
    <ChartCard
      title={formatMonth(calendar.month)}
      description={mode === "calendar" ? "Hours on each calendar date" : "Hours by the date each shift started"}
      className={className}
      headline={
        <p className="flex items-baseline gap-2">
          <span className="type-stat">{formatDuration(calendar.totalMs)}</span>
          <span className="text-xs text-muted-foreground">net this month</span>
        </p>
      }
      table={
        <DataTable
          caption={`Net time per date, ${formatMonth(calendar.month)}`}
          rows={monthCells}
          rowKey={(c) => c.date}
          columns={[
            { label: "Date", cell: (c) => formatDate(c.date, { thisYear }) },
            { label: "Net", numeric: true, cell: (c) => <DrillLink href={sessionsHref(c.sessionIds)}>{netText.get(c.date)}</DrillLink> },
            { label: "From an earlier start", cell: (c) => (c.startedEarlier ? "Yes" : "") },
          ]}
        />
      }
      footer={
        anyEarlier ? (
          <p className="flex items-center gap-2 text-2xs text-muted-foreground">
            <span aria-hidden className="size-2 rounded-full border-[1.5px] border-brand" />
            Includes time from a shift that started the day before
          </p>
        ) : null
      }
    >
      <div ref={ref} className="relative">
        <div
          ref={gridRef}
          role="grid"
          aria-label={`${formatMonth(calendar.month)}, net time per date`}
          className="grid grid-cols-7 gap-1"
          onPointerLeave={() => ix.hover(null)}
        >
          <div role="row" className="contents">
            {calendar.weekdays.map((wd) => (
              <div key={wd} role="columnheader" className="pb-1 text-center text-2xs font-medium text-muted-foreground">
                <span aria-hidden>{width < 400 ? DAY_NAMES[wd][0] : DAY_NAMES[wd]}</span>
                <span className="sr-only">{DAY_NAMES[wd]}</span>
              </div>
            ))}
          </div>
          {calendar.weeks.map((week, wi) => (
            <div role="row" className="contents" key={week[0].date}>
              {week.map((c, di) => {
                const i = wi * 7 + di;
                if (!c.inMonth) return <div key={c.date} role="gridcell" aria-hidden style={{ height: rowH }} />;
                const isActive = ix.active === i;
                return (
                  <div role="gridcell" key={c.date}>
                    <button
                      type="button"
                      data-touch-target
                      aria-label={`${formatDate(c.date, { long: true, thisYear })}: ${c.netMs ? formatDuration(c.netMs) : "no time"}${c.startedEarlier ? ", includes time from a shift that started earlier" : ""}`}
                      aria-pressed={isActive}
                      onPointerEnter={(e) => e.pointerType === "mouse" && ix.hover(i)}
                      onClick={() => ix.pin(isActive && ix.pinned ? null : i)}
                      onFocus={() => ix.pin(i)}
                      onKeyDown={(e) => {
                        const k = e.key;
                        if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Escape"].includes(k)) return;
                        e.preventDefault();
                        if (k === "Escape") return ix.clear();
                        const d = k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : k === "ArrowDown" ? 7 : -7;
                        const next = i + d;
                        if (next >= 0 && next < cells.length && cells[next].inMonth) {
                          (e.currentTarget.closest("[role=grid]")?.querySelectorAll("button")[cells.slice(0, next).filter((x) => x.inMonth).length] as HTMLButtonElement | undefined)?.focus();
                        }
                      }}
                      className={cn(
                        "relative flex w-full flex-col items-start justify-between rounded-[10px] p-1.5 text-left transition-colors duration-150 focus-ring",
                        c.level ? CELL_BG[c.level] : c.future ? "" : "bg-raised/60",
                        c.future && "border border-dashed border-border",
                        isActive && "ring-2 ring-foreground/70",
                        c.isToday && !isActive && "ring-1 ring-foreground/50",
                      )}
                      style={{ height: rowH }}
                    >
                      <span className={cn("text-2xs tabular", c.isToday ? "font-semibold text-foreground" : "text-muted-foreground")}>{Number(c.date.slice(8, 10))}</span>
                      {c.netMs > 0 ? <span className="text-xs font-semibold tabular">{hours(c.netMs)}h</span> : null}
                      {c.startedEarlier ? <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full border-[1.5px] border-brand" /> : null}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {active && ix.active !== null && width > 0 ? (
          <ChartTip
              pinned={ix.pinned}
            x={((ix.active % 7) + 0.5) * colW}
            y={18 + Math.floor(ix.active / 7) * (rowH + 4) + (Math.floor(ix.active / 7) < 2 ? rowH : 0)}
            width={width}
            title={`${formatDate(active.date, { thisYear })} · ${formatDuration(active.netMs)}`}
            href={sessionsHref(active.sessionIds)}
          >
            {active.contributions.length ? (
              <ul className="grid gap-1.5 text-xs">
                {active.contributions.map((c) => {
                  const f = byId.get(c.sessionId);
                  if (!f) return null;
                  const zone = f.session.reportingTimeZone;
                  return (
                    <li key={c.sessionId} className="grid gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className="truncate">{rowTitle({ title: f.session.title, startedAt: f.session.startedAt, zone }, clock)}</span>
                        <span className="ml-auto font-medium tabular">{formatDuration(c.netMs)}</span>
                      </span>
                      {c.startedEarlier ? (
                        <Link href={sessionHref(c.sessionId)} className="w-fit text-2xs text-brand underline-offset-2 hover:underline focus-ring rounded-sm">
                          from {formatDate(c.anchor, { thisYear })} {formatTime(f.session.startedAt, zone, clock)}
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No time on this date.</p>
            )}
          </ChartTip>
        ) : null}
      </div>
    </ChartCard>
  );
}
