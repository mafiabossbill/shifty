"use client";

/**
 * D. Net per day (or week) with breaks stacked faintly on top and the target as a dashed step line
 * (Σ goals of the sessions that started in each bar). The bar holding today is the solid one.
 */
import * as React from "react";

import { formatDate, formatDuration, formatMonth, spokenDuration, weekdayShort } from "@/lib/format";
import { durationsByRow, sessionsHref, spanLabel } from "@/lib/insights/labels";
import type { BarDatum, BarsModel } from "@/lib/insights/model";
import { hourScale, hourTick, labelEvery } from "@/lib/insights/scale";
import type { LocalDate } from "@/lib/time/zone";
import { cn } from "@/lib/utils";

import { ChartCard, ChartSurface, ChartTip, DataTable, DrillLink, LegendItem, useChartInteraction, useElementWidth } from "./chart-kit";

function barTitle(d: BarDatum, unit: BarsModel["unit"], today: LocalDate): string {
  const y = today.slice(0, 4);
  if (unit === "day") return formatDate(d.from, { thisYear: y });
  if (unit === "month") return formatMonth(d.key);
  return spanLabel(d.from, d.to, y);
}

function barTick(d: BarDatum, unit: BarsModel["unit"], count: number): string {
  if (unit === "day") return count <= 7 ? weekdayShort(d.from) : String(Number(d.from.slice(8, 10)));
  if (unit === "month") return formatMonth(d.key, false).slice(0, 3);
  return `${Number(d.from.slice(8, 10))} ${formatMonth(d.from.slice(0, 7), false).slice(0, 3)}`;
}

export function BarsCard({ bars, today, className }: { bars: BarsModel; today: LocalDate; className?: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const ix = useChartInteraction(bars.data.length);
  const n = bars.data.length;
  const height = width < 480 ? 196 : 228;
  const m = { top: 14, right: 4, bottom: 26, left: 34 };
  const innerW = Math.max(0, width - m.left - m.right);
  const innerH = height - m.top - m.bottom;
  const maxGoal = Math.max(0, ...bars.data.map((d) => d.goalMs));
  const scale = hourScale(Math.max(maxGoal, ...bars.data.map((d) => d.netMs + d.breakMs)), 4);
  const y = (ms: number) => m.top + innerH - (ms / scale.maxMs) * innerH;
  const step = n ? innerW / n : 0;
  const barW = Math.max(2, Math.min(40, step * (n > 20 ? 0.7 : 0.58)));
  const radius = Math.min(barW / 2, 6);
  const every = labelEvery(n, step, bars.unit === "week" ? 44 : 22);
  const title = bars.unit === "day" ? (bars.matchesRange ? "Net per day" : "Last 7 days") : bars.unit === "week" ? "Net per week" : "Net per month";
  const empty = bars.totalMs === 0 && bars.data.every((d) => d.breakMs === 0) ? (bars.matchesRange ? "No time in this range yet." : "No time in the last 7 days.") : null;
  const active = ix.active !== null ? bars.data[ix.active] : null;
  const netText = durationsByRow(bars.data, (d) => d.key, (d) => d.netMs);
  const breakText = durationsByRow(bars.data, (d) => d.key, (d) => d.breakMs);

  return (
    <ChartCard
      title={title}
      description={bars.matchesRange ? "Breaks on top · dashed: goals of the shifts that started there" : "Today in the context of its week"}
      className={className}
      headline={
        <p className="flex items-baseline gap-2">
          <span className="type-stat">{formatDuration(bars.totalMs)}</span>
          <span className="text-xs text-muted-foreground">net {bars.matchesRange ? "in this range" : "in the last 7 days"}</span>
        </p>
      }
      empty={empty}
      table={
        <DataTable
          caption={title}
          rows={bars.data}
          rowKey={(d) => d.key}
          columns={[
            { label: bars.unit === "day" ? "Date" : bars.unit === "week" ? "Week" : "Month", cell: (d) => barTitle(d, bars.unit, today) },
            { label: "Net", numeric: true, cell: (d) => <DrillLink href={sessionsHref(d.sessionIds)}>{netText.get(d.key)}</DrillLink> },
            { label: "Breaks", numeric: true, cell: (d) => breakText.get(d.key) },
            { label: "Target", numeric: true, cell: (d) => (d.goalMs ? formatDuration(d.goalMs) : "—") },
          ]}
          foot={["Total", formatDuration(bars.totalMs), formatDuration(bars.data.reduce((s, d) => s + d.breakMs, 0)), ""]}
        />
      }
      footer={
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <LegendItem kind="net" label="Net" />
          <LegendItem kind="break" label="Breaks" />
          <LegendItem kind="target" label="Target" />
        </div>
      }
    >
      <div ref={ref} className="min-h-[196px]">
        {width > 0 ? (
          <ChartSurface interaction={ix} label={`${title}: ${spokenDuration(bars.totalMs)} in total`}>
            <svg width={width} height={height} className="block touch-manipulation" role="presentation" {...ix.surface((x) => (step > 0 && x >= m.left ? Math.min(n - 1, Math.floor((x - m.left) / step)) : null))}>
              {scale.ticks.map((t) => (
                <g key={t}>
                  <line x1={m.left} x2={width - m.right} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} className={t === 0 ? "stroke-border-strong" : "stroke-border"} strokeWidth={1} />
                  <text x={m.left - 8} y={y(t)} dy="0.35em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular">
                    {hourTick(t)}
                  </text>
                </g>
              ))}
              {bars.data.map((d, i) => {
                const cx = m.left + step * (i + 0.5);
                const x = cx - barW / 2;
                const netTop = y(d.netMs);
                const brkTop = y(d.netMs + d.breakMs);
                const base = y(0);
                return (
                  <g key={d.key}>
                    {ix.active === i ? <rect x={m.left + step * i} y={m.top} width={step} height={innerH} className="fill-foreground/[0.05]" rx={6} /> : null}
                    {d.breakMs > 0 ? <rect x={x} y={brkTop} width={barW} height={Math.max(0, base - brkTop)} rx={radius} className="fill-brand/25" /> : null}
                    {d.netMs > 0 ? (
                      <rect
                        x={x}
                        y={netTop}
                        width={barW}
                        height={Math.max(Math.min(2, radius * 2), base - netTop)}
                        rx={radius}
                        className={cn("fill-brand", !d.isToday && "opacity-80", d.isToday && "dark:drop-shadow-[0_0_6px_var(--glow)]")}
                      />
                    ) : null}
                    {i % every === 0 || (n <= 7) ? (
                      <text x={cx} y={height - 8} textAnchor="middle" className={cn("text-[10px] tabular", d.isToday ? "fill-foreground font-semibold" : "fill-muted-foreground")}>
                        {barTick(d, bars.unit, n)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
              {bars.data.map((d, i) =>
                d.goalMs > 0 && d.goalMs <= scale.maxMs ? (
                  <line
                    key={`g-${d.key}`}
                    x1={m.left + step * i + 1}
                    x2={m.left + step * (i + 1) - 1}
                    y1={y(d.goalMs)}
                    y2={y(d.goalMs)}
                    className="stroke-foreground/55"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                ) : null,
              )}
            </svg>
            {active && ix.active !== null ? (
              <ChartTip
              pinned={ix.pinned}
                x={m.left + step * (ix.active + 0.5)}
                y={Math.min(y(active.netMs + active.breakMs), y(active.goalMs || 0))}
                width={width}
                title={barTitle(active, bars.unit, today)}
                rows={[
                  { label: "Net", value: formatDuration(active.netMs), swatch: "net" },
                  { label: "Breaks", value: formatDuration(active.breakMs), swatch: "break" },
                  ...(active.goalMs ? [{ label: "Target", value: formatDuration(active.goalMs), swatch: "target" as const }] : []),
                ]}
                href={sessionsHref(active.sessionIds)}
              />
            ) : null}
          </ChartSurface>
        ) : null}
      </div>
    </ChartCard>
  );
}
