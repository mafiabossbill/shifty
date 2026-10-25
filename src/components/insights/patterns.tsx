"use client";

/**
 * F. Clock-in time of day (24-bar strip with the typical start marked) and
 * G. Session length distribution (2-hour bins with mean and median markers).
 */
import * as React from "react";

import { formatDuration, spokenDuration, type ClockFormat } from "@/lib/format";
import { clockLabel, plural, sessionsHref } from "@/lib/insights/labels";
import type { ClockInModel } from "@/lib/insights/model";
import { clamp } from "@/lib/insights/scale";
import type { DurationStats } from "@/lib/reports";
import { cn } from "@/lib/utils";

import { ChartCard, ChartSurface, ChartTip, DataTable, DrillLink, useChartInteraction, useElementWidth } from "./chart-kit";

interface Column {
  key: string;
  count: number;
  sessionIds: string[];
  tick: string | null;
  title: string;
}

/** Count columns with sparse ticks, a hover column and the shared tooltip. `markers` draw at a fractional column position. */
function CountColumns({
  columns,
  label,
  markers = [],
  highlight,
}: {
  columns: Column[];
  label: string;
  markers?: { at: number; label: string; style: "solid" | "dotted" | "caret" }[];
  highlight?: (i: number) => boolean;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const ix = useChartInteraction(columns.length);
  const height = 132;
  const m = { top: markers.length ? 22 : 8, bottom: 20, left: 2, right: 2 };
  const innerW = Math.max(0, width - m.left - m.right);
  const innerH = height - m.top - m.bottom;
  const n = columns.length;
  const step = n ? innerW / n : 0;
  const barW = Math.max(2, step * 0.66);
  const max = Math.max(1, ...columns.map((c) => c.count));
  const y = (v: number) => m.top + innerH - (v / max) * innerH;
  const active = ix.active !== null ? columns[ix.active] : null;
  return (
    <div ref={ref} className="min-h-[132px]">
      {width > 0 ? (
        <ChartSurface interaction={ix} label={label}>
          <svg width={width} height={height} className="block touch-manipulation" role="presentation" {...ix.surface((x) => (step > 0 ? clamp(Math.floor((x - m.left) / step), 0, n - 1) : null))}>
            <line x1={m.left} x2={width - m.right} y1={y(0) + 0.5} y2={y(0) + 0.5} className="stroke-border-strong" />
            {columns.map((c, i) => {
              const cx = m.left + step * (i + 0.5);
              const top = y(c.count);
              return (
                <g key={c.key}>
                  {ix.active === i ? <rect x={m.left + step * i} y={m.top} width={step} height={innerH} rx={4} className="fill-foreground/[0.05]" /> : null}
                  {c.count > 0 ? (
                    <rect x={cx - barW / 2} y={top} width={barW} height={Math.max(2, y(0) - top)} rx={Math.min(barW / 2, 4)} className={cn("fill-brand", highlight?.(i) ? "" : "opacity-75")} />
                  ) : (
                    <rect x={cx - barW / 2} y={y(0) - 2} width={barW} height={2} rx={1} className="fill-track" />
                  )}
                  {c.tick ? (
                    <text x={cx} y={height - 5} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular">
                      {c.tick}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {markers.map((mk, k) => {
              const x = m.left + step * mk.at;
              return (
                <g key={k}>
                  {mk.style === "caret" ? (
                    <path d={`M${x - 4} ${m.top - 10} L${x + 4} ${m.top - 10} L${x} ${m.top - 4} Z`} className="fill-foreground" />
                  ) : (
                    <line x1={x} x2={x} y1={m.top - 6} y2={y(0)} className="stroke-foreground/70" strokeWidth={1.25} strokeDasharray={mk.style === "dotted" ? "1.5 2.5" : undefined} />
                  )}
                  <text x={clamp(x, 24, width - 24)} y={m.top - 12} textAnchor="middle" className="fill-foreground text-[10px] font-medium tabular">
                    {mk.label}
                  </text>
                </g>
              );
            })}
          </svg>
          {active && ix.active !== null ? (
            <ChartTip
              pinned={ix.pinned}
              x={m.left + step * (ix.active + 0.5)}
              y={y(active.count)}
              width={width}
              title={active.title}
              rows={[{ label: "Sessions", value: String(active.count), swatch: "net" }]}
              href={sessionsHref(active.sessionIds)}
            />
          ) : null}
        </ChartSurface>
      ) : null}
    </div>
  );
}

export function ClockInCard({ clockIn, clock, className }: { clockIn: ClockInModel; clock: ClockFormat; className?: string }) {
  const hourName = (h: number) => `${clockLabel(h * 60, clock)}–${clockLabel(h * 60 + 59, clock)}`;
  const columns: Column[] = clockIn.hours.map((h) => ({
    key: String(h.hour),
    count: h.count,
    sessionIds: h.sessionIds,
    tick: h.hour % 6 === 0 ? clockLabel(h.hour * 60, clock).replace(":00", "") : null,
    title: hourName(h.hour),
  }));
  const typical = clockIn.typicalMinute;
  return (
    <ChartCard
      title="Clock-in time"
      description="When the shifts in this range started, by hour"
      className={className}
      empty={clockIn.total === 0 ? "No clock-ins in this range yet." : null}
      headline={
        <p className="flex items-baseline gap-2">
          <span className="type-stat">{typical !== null ? `~${clockLabel(typical, clock)}` : "Varies"}</span>
          <span className="text-xs text-muted-foreground">{typical !== null ? "typical start" : "start times spread through the day"}</span>
        </p>
      }
      table={
        <DataTable
          caption="Clock-ins per hour of the day"
          rows={clockIn.hours.filter((h) => h.count > 0)}
          rowKey={(h) => String(h.hour)}
          columns={[
            { label: "Hour", cell: (h) => hourName(h.hour) },
            { label: "Clock-ins", numeric: true, cell: (h) => <DrillLink href={sessionsHref(h.sessionIds)}>{h.count}</DrillLink> },
          ]}
        />
      }
    >
      <CountColumns
        columns={columns}
        label={`Clock-ins by hour: ${plural(clockIn.total, "clock-in")}${typical !== null ? `, typically around ${clockLabel(typical, clock)}` : ""}`}
        markers={typical !== null ? [{ at: typical / 60, label: `~${clockLabel(typical, clock)}`, style: "caret" }] : []}
        highlight={(i) => typical !== null && Math.floor(typical / 60) === i}
      />
    </ChartCard>
  );
}

export function DurationsCard({ durations, className }: { durations: DurationStats; className?: string }) {
  const columns: Column[] = durations.histogram.map((b, i) => ({
    key: b.label,
    count: b.count,
    sessionIds: b.sessionIds,
    tick: i % 2 === 0 || i === 10 ? (b.toH === null ? "20h+" : `${b.fromH}h`) : null,
    title: b.toH === null ? `${b.fromH}h or longer` : `${b.fromH}h to ${b.toH}h`,
  }));
  const at = (ms: number) => clamp(ms / 7_200_000, 0, 11);
  const close = Math.abs(at(durations.meanMs) - at(durations.medianMs)) < 1.4;
  return (
    <ChartCard
      title="Session length"
      description="Finished shifts in this range, net time in 2-hour steps"
      className={className}
      empty={durations.count === 0 ? "No finished shifts in this range yet." : null}
      headline={
        <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <div className="flex items-baseline gap-2">
            <dt className="text-xs text-muted-foreground">Mean</dt>
            <dd className="type-stat">{formatDuration(durations.meanMs)}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-xs text-muted-foreground">Median</dt>
            <dd className="type-stat">{formatDuration(durations.medianMs)}</dd>
          </div>
        </dl>
      }
      table={
        <DataTable
          caption="Finished sessions by net length"
          rows={durations.histogram}
          rowKey={(b) => b.label}
          columns={[
            { label: "Length", cell: (b) => (b.toH === null ? `${b.fromH}h or longer` : `${b.fromH}–${b.toH}h`) },
            { label: "Sessions", numeric: true, cell: (b) => <DrillLink href={sessionsHref(b.sessionIds)}>{b.count}</DrillLink> },
          ]}
          foot={["Mean / median", `${formatDuration(durations.meanMs)} / ${formatDuration(durations.medianMs)}`]}
        />
      }
      footer={
        <p className="flex flex-wrap gap-x-4 text-2xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <svg width="2" height="10" aria-hidden>
              <line x1="1" x2="1" y1="0" y2="10" className="stroke-foreground/70" strokeWidth="1.25" />
            </svg>
            Mean
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="2" height="10" aria-hidden>
              <line x1="1" x2="1" y1="0" y2="10" className="stroke-foreground/70" strokeWidth="1.25" strokeDasharray="1.5 2.5" />
            </svg>
            Median
          </span>
          <span>{plural(durations.count, "finished shift")}</span>
        </p>
      }
    >
      <CountColumns
        columns={columns}
        label={`Session lengths: ${plural(durations.count, "finished shift")}, mean ${spokenDuration(durations.meanMs)}, median ${spokenDuration(durations.medianMs)}`}
        markers={[
          { at: at(durations.meanMs), label: close ? "" : "Mean", style: "solid" },
          { at: at(durations.medianMs), label: close ? "Mean · median" : "Median", style: "dotted" },
        ]}
      />
    </ChartCard>
  );
}
