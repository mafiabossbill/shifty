"use client";

/**
 * B. Day-split ribbon. Each session is ONE connected band on an hours-from-local-midnight axis (of the
 * day it started, in its reporting zone), colour-split at every calendar midnight: the start date in the
 * brand, the next date in a lighter tint, alternating. Breaks are gaps over a hairline that keeps the
 * band connected. Rows are stacked by start; tap a row for exact times and the session.
 */
import * as React from "react";

import { formatDate, formatDuration, formatTime, smartTitle, spokenDuration, weekdayShort, zoneAbbreviation, type ClockFormat } from "@/lib/format";
import { clockLabel, plural, sessionHref, sessionsHref } from "@/lib/insights/labels";
import type { RibbonModel, RibbonRow } from "@/lib/insights/model";
import { deviceTimeZone, wallClock, type LocalDate } from "@/lib/time/zone";
import { cn } from "@/lib/utils";

import { ChartCard, ChartSurface, ChartTip, DataTable, DrillLink, LegendItem, useChartInteraction, useElementWidth } from "./chart-kit";

/** The session's title, or the same friendly default the rest of the app uses ("Evening shift"). */
export function rowTitle(row: Pick<RibbonRow, "title" | "startedAt" | "zone">, clock: ClockFormat): string {
  void clock;
  return row.title?.trim() || smartTitle(wallClock(row.startedAt, row.zone).hour);
}

/** "Mon 26 Oct 18:00 → Tue 27 Oct 10:00 EAT" (zone shown when it isn't the device's). */
export function spanText(row: Pick<RibbonRow, "startedAt" | "end" | "zone" | "running" | "anchor">, clock: ClockFormat, today: LocalDate): string {
  const y = today.slice(0, 4);
  const startDate = formatDate(row.anchor, { thisYear: y });
  const endDateLocal = new Intl.DateTimeFormat("en-CA", { timeZone: row.zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(row.end));
  const end = row.running ? "now" : `${endDateLocal === row.anchor ? "" : `${formatDate(endDateLocal, { thisYear: y })} `}${formatTime(row.end, row.zone, clock)}`;
  const zone = row.zone !== deviceTimeZone() ? ` ${zoneAbbreviation(row.startedAt, row.zone)}` : "";
  return `${startDate} ${formatTime(row.startedAt, row.zone, clock)} → ${end}${zone}`;
}

/** Axis labels without collisions: midnights first, then the others where they fit; edge labels hug the edge. */
function axisLabels(ticks: RibbonModel["axis"]["ticks"], x: (h: number) => number, clock: ClockFormat, phone: boolean, width: number) {
  const charW = 5.6;
  const items = ticks.map((t) => {
    const text = t.midnight && t.h > 0 ? (phone ? `+${t.h / 24}d` : `Midnight +${t.h / 24}d`) : clockLabel((((t.h % 24) + 24) % 24) * 60, clock);
    const w = text.length * charW;
    const cx = x(t.h);
    let anchor: "start" | "middle" | "end" = "middle";
    let lx = cx;
    let from = cx - w / 2;
    if (cx + w / 2 > width) {
      anchor = "end";
      lx = width;
      from = width - w;
    } else if (cx - w / 2 < 0) {
      anchor = "start";
      lx = 0;
      from = 0;
    }
    return { text, x: lx, anchor, from, to: from + w, midnight: t.midnight && t.h > 0 };
  });
  const placed: { from: number; to: number }[] = [];
  const out: (null | { text: string; x: number; anchor: "start" | "middle" | "end" })[] = items.map(() => null);
  const order = items.map((it, i) => ({ it, i })).sort((a, b) => Number(b.it.midnight) - Number(a.it.midnight));
  for (const { it, i } of order) {
    if (placed.some((p) => it.from < p.to + 8 && it.to > p.from - 8)) continue;
    placed.push(it);
    out[i] = { text: it.text, x: it.x, anchor: it.anchor };
  }
  return out;
}

export function RibbonChart({
  ribbon,
  clock,
  today,
  rowHeight,
  showDayLabels = false,
  label,
}: {
  ribbon: RibbonModel;
  clock: ClockFormat;
  today: LocalDate;
  rowHeight?: number;
  /** Write each day's net on its segment (single-session view). */
  showDayLabels?: boolean;
  label: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const ix = useChartInteraction(ribbon.rows.length);
  const phone = width < 480;
  const rowH = rowHeight ?? (phone ? 12 : 14);
  const gap = rowHeight ? 10 : phone ? 7 : 8;
  const labelW = ribbon.rows.length > 1 ? (phone ? 44 : 64) : 0;
  const top = 22;
  const height = top + ribbon.rows.length * (rowH + gap) + 2 + (showDayLabels ? 18 : 0);
  const { fromH, toH, ticks } = ribbon.axis;
  const left = labelW + 6;
  const right = width - 6;
  const x = (h: number) => left + ((h - fromH) / Math.max(1e-9, toH - fromH)) * Math.max(0, right - left);
  const rowY = (i: number) => top + i * (rowH + gap);
  const tickLabels = axisLabels(ticks, x, clock, phone, width);
  const clipBase = React.useId().replace(/:/g, "");
  const active = ix.active !== null ? ribbon.rows[ix.active] : null;

  return (
    <div ref={ref} className="min-h-12">
      {width > 0 ? (
        <ChartSurface interaction={ix} label={label}>
          <svg
            width={width}
            height={height}
            className="block touch-manipulation"
            role="presentation"
            {...ix.surface((_, py) => {
              const i = Math.floor((py - top + gap / 2) / (rowH + gap));
              return i >= 0 && i < ribbon.rows.length ? i : null;
            })}
          >
            {ticks.map((t, i) => (
              <g key={t.h}>
                <line
                  x1={Math.round(x(t.h)) + 0.5}
                  x2={Math.round(x(t.h)) + 0.5}
                  y1={top - 6}
                  y2={height}
                  className={t.midnight ? "stroke-border-strong" : "stroke-border"}
                  strokeWidth={1}
                  strokeDasharray={t.midnight ? undefined : "1 3"}
                />
                {tickLabels[i] ? (
                  <text x={tickLabels[i]!.x} y={10} textAnchor={tickLabels[i]!.anchor} className={cn("text-[10px] tabular", t.midnight ? "fill-foreground font-medium" : "fill-muted-foreground")}>
                    {tickLabels[i]!.text}
                  </text>
                ) : null}
              </g>
            ))}
            {ribbon.rows.map((row, i) => {
              const y0 = rowY(i);
              const dim = ix.active !== null && ix.active !== i;
              const clipId = `${clipBase}-r${i}`;
              const sx = x(row.startH);
              const ex = Math.max(sx + 2, x(row.endH));
              return (
                <g key={row.sessionId} className={cn("transition-opacity duration-150", dim && "opacity-40")}>
                  {labelW ? (
                    <text x={0} y={y0 + rowH / 2} dy="0.35em" className={cn("text-[10px] tabular", row.anchor === today ? "fill-foreground font-semibold" : "fill-muted-foreground")}>
                      {`${weekdayShort(row.anchor)} ${Number(row.anchor.slice(8, 10))}`}
                    </text>
                  ) : null}
                  <line x1={sx} x2={ex} y1={y0 + rowH / 2} y2={y0 + rowH / 2} className="stroke-muted-foreground/40" strokeWidth={1.5} />
                  <clipPath id={clipId}>
                    <rect x={sx} y={y0} width={ex - sx} height={rowH} rx={rowH / 2} />
                  </clipPath>
                  <g clipPath={`url(#${clipId})`}>
                    {row.segments.map((s, k) => (
                      <rect
                        key={k}
                        x={x(s.fromH)}
                        y={y0}
                        width={Math.max(0.5, x(s.toH) - x(s.fromH))}
                        height={rowH}
                        className={s.dayIndex % 2 === 0 ? "fill-brand" : "fill-brand/45"}
                      />
                    ))}
                  </g>
                  {row.running ? <circle cx={ex} cy={y0 + rowH / 2} r={rowH / 2 + 2} className="fill-none stroke-brand motion-safe:animate-pulse" strokeWidth={1.5} /> : null}
                  {showDayLabels
                    ? row.days.map((d, k) => {
                        const segs = row.segments.filter((s) => s.date === d.date);
                        if (!segs.length) return null;
                        const a = x(segs[0].fromH);
                        const b = x(segs[segs.length - 1].toH);
                        if (b - a < 56) return null;
                        return (
                          <text key={d.date} x={(a + b) / 2} y={y0 + rowH + 14} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular">
                            {`${formatDate(d.date, { weekday: true }).split(" ")[0]} ${formatDuration(d.netMs)}`}
                            <title>{`Day ${k + 1}`}</title>
                          </text>
                        );
                      })
                    : null}
                </g>
              );
            })}
          </svg>
          {active && ix.active !== null ? (
            <ChartTip
              pinned={ix.pinned}
              x={(x(active.startH) + x(active.endH)) / 2}
              y={rowY(ix.active) + (rowY(ix.active) < 120 ? rowH : 0)}
              width={width}
              title={rowTitle(active, clock)}
              rows={[
                ...active.days.map((d, k) => ({
                  label: formatDate(d.date, { thisYear: today.slice(0, 4) }),
                  value: formatDuration(d.netMs),
                  swatch: (k % 2 === 0 ? "net" : "break") as "net" | "break",
                })),
                { label: "Breaks", value: formatDuration(active.breakMs) },
                { label: "Net", value: formatDuration(active.netMs) },
              ]}
              href={sessionHref(active.sessionId)}
              hrefLabel="Open session"
            >
              <p className="-mt-1 text-2xs text-muted-foreground tabular">{spanText(active, clock, today)}</p>
            </ChartTip>
          ) : null}
        </ChartSurface>
      ) : null}
    </div>
  );
}

export function RibbonCard({ ribbon, clock, today, sessionIds, className }: { ribbon: RibbonModel; clock: ClockFormat; today: LocalDate; sessionIds: string[]; className?: string }) {
  const total = ribbon.rows.reduce((s, r) => s + r.netMs, 0);
  return (
    <ChartCard
      title="Day-split ribbon"
      description="Each shift as one band from its start; the colour changes at midnight"
      className={className}
      empty={ribbon.rows.length === 0 ? "No shifts in this range yet." : null}
      table={
        <DataTable
          caption="Shifts in this range and the days they touch"
          rows={ribbon.rows}
          rowKey={(r) => r.sessionId}
          columns={[
            { label: "Shift", cell: (r) => <DrillLink href={sessionHref(r.sessionId)}>{spanText(r, clock, today)}</DrillLink> },
            { label: "By day", cell: (r) => r.days.map((d) => `${formatDate(d.date, { weekday: true }).split(" ").slice(0, 2).join(" ")} ${formatDuration(d.netMs)}`).join(" · ") },
            { label: "Breaks", numeric: true, cell: (r) => formatDuration(r.breakMs) },
            { label: "Net", numeric: true, cell: (r) => formatDuration(r.netMs) },
          ]}
        />
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <LegendItem kind="net" label="Start date" />
          <LegendItem kind="next" label="Next date" />
          <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
            <svg width="16" height="6" aria-hidden>
              <line x1="0" x2="16" y1="3" y2="3" className="stroke-muted-foreground/50" strokeWidth="1.5" />
            </svg>
            Break
          </span>
          {ribbon.hidden > 0 ? (
            <span className="ml-auto text-2xs text-muted-foreground">
              Latest {ribbon.rows.length} of {ribbon.rows.length + ribbon.hidden} ·{" "}
              <DrillLink href={sessionsHref(sessionIds)}>{`View all ${plural(sessionIds.length, "session")}`}</DrillLink>
            </span>
          ) : null}
        </div>
      }
    >
      <RibbonChart ribbon={ribbon} clock={clock} today={today} label={`Shifts in this range as bands across midnight: ${ribbon.rows.length} shifts, ${spokenDuration(total)} net`} />
    </ChartCard>
  );
}
