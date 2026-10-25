"use client";

/**
 * C. Activity heatmap for the last 7 / 30 / 90 days: week rows from the person's week start, rounded
 * cells in five levels of the brand tint (relative to the busiest day), month labels in the margin.
 */
import * as React from "react";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { formatDate, formatDuration, spokenDuration, weekdayShort } from "@/lib/format";
import { sessionsHref } from "@/lib/insights/labels";
import type { HeatGrid } from "@/lib/insights/model";
import type { HeatDays } from "@/lib/insights/params";
import type { LocalDate } from "@/lib/time/zone";
import { cn } from "@/lib/utils";

import { ChartCard, ChartSurface, ChartTip, DataTable, DrillLink, useChartInteraction, useElementWidth } from "./chart-kit";

export const HEAT_FILL = ["fill-track", "fill-brand/25", "fill-brand/45", "fill-brand/70", "fill-brand"] as const;
export const HEAT_BG = ["bg-track", "bg-brand/25", "bg-brand/45", "bg-brand/70", "bg-brand"] as const;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function HeatmapCard({
  heat,
  today,
  onDays,
  className,
}: {
  heat: HeatGrid;
  today: LocalDate;
  onDays: (days: HeatDays) => void;
  className?: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const slots = heat.rows.flatMap((r) => r.slots);
  const ix = useChartInteraction(slots.length, { columns: 7, skip: (i) => slots[i].outside || slots[i].date > today });
  const labelW = 34;
  const gap = heat.days === 90 ? 4 : 6;
  const maxCell = heat.days === 7 ? 44 : heat.days === 30 ? 38 : 28;
  const cell = Math.max(10, Math.min(maxCell, Math.floor((width - labelW - gap * 6) / 7)));
  const gridW = labelW + cell * 7 + gap * 6;
  const top = 18;
  const height = top + heat.rows.length * (cell + gap);
  const active = ix.active !== null ? slots[ix.active] : null;
  const pos = (i: number) => ({ col: i % 7, row: Math.floor(i / 7) });
  const thisYear = today.slice(0, 4);

  return (
    <ChartCard
      title="Activity"
      description={`Last ${heat.days} days · ${heat.activeDays} with time`}
      className={className}
      empty={heat.totalMs === 0 ? `No time in the last ${heat.days} days.` : null}
      headline={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-baseline gap-2">
            <span className="type-stat">{formatDuration(heat.totalMs)}</span>
            <span className="text-xs text-muted-foreground">net</span>
          </p>
        <SegmentedControl<string>
          ariaLabel="Heatmap span"
          size="sm"
          value={String(heat.days)}
          onValueChange={(v) => onDays(Number(v) as HeatDays)}
          options={[
            { value: "7", label: "7d", ariaLabel: "Last 7 days" },
            { value: "30", label: "30d", ariaLabel: "Last 30 days" },
            { value: "90", label: "90d", ariaLabel: "Last 90 days" },
          ]}
        />
        </div>
      }
      table={
        <DataTable
          caption={`Net time per day, last ${heat.days} days`}
          rows={slots.filter((s) => !s.outside).reverse()}
          rowKey={(s) => s.date}
          columns={[
            { label: "Date", cell: (s) => formatDate(s.date, { thisYear }) },
            { label: "Net", numeric: true, cell: (s) => <DrillLink href={sessionsHref(s.sessionIds)}>{formatDuration(s.netMs)}</DrillLink> },
            { label: "Level", numeric: true, cell: (s) => `${s.level} of 4` },
          ]}
        />
      }
      footer={
        <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          Less
          {HEAT_BG.map((c, i) => (
            <span key={i} aria-hidden className={cn("size-3 rounded-[4px]", c)} />
          ))}
          More
          <span className="ml-auto">Relative to your busiest day</span>
        </div>
      }
    >
      <div ref={ref} className="min-h-32">
        {width > 0 ? (
          <ChartSurface interaction={ix} label={`Activity heatmap, last ${heat.days} days: ${spokenDuration(heat.totalMs)} on ${heat.activeDays} days`} className="w-fit" style={{ width: gridW }}>
            <svg
              width={gridW}
              height={height}
              className="block touch-manipulation"
              role="presentation"
              {...ix.surface((x, y) => {
                if (x < labelW || y < top) return null;
                const col = Math.floor((x - labelW) / (cell + gap));
                const row = Math.floor((y - top) / (cell + gap));
                const i = row * 7 + col;
                return col >= 0 && col < 7 && i < slots.length ? i : null;
              })}
            >
              {heat.weekdays.map((wd, c) => (
                <text key={wd} x={labelW + c * (cell + gap) + cell / 2} y={10} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {cell >= 26 ? DAY_NAMES[wd] : DAY_NAMES[wd][0]}
                </text>
              ))}
              {heat.rows.map((r, ri) =>
                r.monthLabel ? (
                  <text key={`m-${r.weekOf}`} x={0} y={top + ri * (cell + gap) + cell / 2} dy="0.35em" className="fill-muted-foreground text-[10px] font-medium">
                    {r.monthLabel}
                  </text>
                ) : null,
              )}
              {slots.map((s, i) => {
                if (s.outside) return null;
                const { col, row } = pos(i);
                const x = labelW + col * (cell + gap);
                const y = top + row * (cell + gap);
                const future = s.date > today;
                return (
                  <rect
                    key={s.date}
                    x={x}
                    y={y}
                    width={cell}
                    height={cell}
                    rx={Math.round(cell * 0.28)}
                    className={cn(
                      future ? "fill-none stroke-border" : HEAT_FILL[s.level],
                      s.date === today && "stroke-foreground",
                      ix.active === i && "stroke-foreground",
                    )}
                    strokeWidth={s.date === today || ix.active === i ? 1.5 : future ? 1 : 0}
                    strokeDasharray={future ? "2 3" : undefined}
                  />
                );
              })}
            </svg>
            {active && ix.active !== null ? (
              <ChartTip
              pinned={ix.pinned}
                x={labelW + pos(ix.active).col * (cell + gap) + cell / 2}
                y={top + pos(ix.active).row * (cell + gap) + (top + pos(ix.active).row * (cell + gap) < 120 ? cell : 0)}
                width={gridW}
                title={`${weekdayShort(active.date)} ${formatDate(active.date, { weekday: false, thisYear })}`}
                rows={[{ label: "Net", value: formatDuration(active.netMs), swatch: "net" }]}
                href={sessionsHref(active.sessionIds)}
              />
            ) : null}
          </ChartSurface>
        ) : null}
      </div>
    </ChartCard>
  );
}
