"use client";

/**
 * A. "Hours in motion": the hero. Up to 7 values → concentric day rings (today's ring is the live one);
 * more → radial bars around the total. One hue, a dashed spoke/circle for the goal, one soft glow.
 * The centre is the readout: hover, tap or arrow keys show a day's exact values there.
 */
import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/status-pill";
import { formatDate, formatDuration, spokenDuration, weekdayShort } from "@/lib/format";
import { durationsByRow, plural, rangeLabel, sessionsHref, spanLabel } from "@/lib/insights/labels";
import type { InsightsModel, RingDatum } from "@/lib/insights/model";
import type { RangeKind } from "@/lib/insights/params";
import { HOLE, polar, ringAt, ringOffset, ringTracks, spokeAt, spokeLayout } from "@/lib/insights/radial";
import type { LocalDate } from "@/lib/time/zone";
import { cn } from "@/lib/utils";

import { ChartSurface, DataTable, DrillLink, useChartInteraction, useElementWidth } from "./chart-kit";

function datumLabel(d: RingDatum, today: LocalDate): string {
  return d.from === d.to ? formatDate(d.from, { thisYear: today.slice(0, 4) }) : spanLabel(d.from, d.to, today.slice(0, 4));
}

export function HoursRing({
  model,
  kind,
  today,
  live,
  className,
}: {
  model: InsightsModel;
  kind: RangeKind;
  today: LocalDate;
  /** A running session contributes to this range. */
  live: boolean;
  className?: string;
}) {
  const { ring, summary } = model;
  const netText = durationsByRow(ring.data, (d) => d.key, (d) => d.netMs);
  const breakText = durationsByRow(ring.data, (d) => d.key, (d) => d.breakMs);
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const size = Math.max(220, Math.min(width || 300, 340));
  const ix = useChartInteraction(ring.data.length);
  const [asTable, setAsTable] = React.useState(false);
  const active = ix.active !== null ? ring.data[ix.active] : null;
  const label = rangeLabel(model.range, kind, today);
  const avg = summary.daysWorked ? summary.netMs / summary.daysWorked : 0;
  const differs = model.otherMode.netMs !== summary.netMs;

  return (
    <Card variant="hero" padding="lg" className={cn("min-w-0 items-center gap-5", className)} role="region" aria-label="Hours in motion">
      <div className="flex w-full items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 className="font-display text-base font-semibold tracking-tight">Hours in motion</h2>
          <p className="text-xs text-muted-foreground">
            {ring.form === "rings" ? (ring.data.length === 1 ? "Net time today" : "One ring per day, outermost first") : ring.unit === "week" ? "One bar per week" : "One bar per day"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {live ? <Pill tone="accent" dot live size="sm">Live</Pill> : null}
          <Button variant="ghost" size="xs" className="text-muted-foreground" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
            {asTable ? "Chart" : "Table"}
          </Button>
        </div>
      </div>

      {asTable ? (
        <div className="max-h-80 w-full overflow-auto rounded-control border border-border" data-scroll-area>
          <DataTable
            caption={`Net time per ${ring.unit}, ${label}`}
            rows={ring.data}
            rowKey={(d) => d.key}
            columns={[
              { label: ring.unit === "week" ? "Week" : "Date", cell: (d) => datumLabel(d, today) },
              { label: "Net", numeric: true, cell: (d) => <DrillLink href={sessionsHref(d.sessionIds)}>{netText.get(d.key)}</DrillLink> },
              { label: "Breaks", numeric: true, cell: (d) => breakText.get(d.key) },
            ]}
            foot={["Total", formatDuration(summary.netMs), formatDuration(summary.breakMs)]}
          />
        </div>
      ) : (
        <div ref={ref} className="grid w-full justify-items-center">
          <ChartSurface interaction={ix} label={`Net time per ${ring.unit}, ${label}: ${spokenDuration(summary.netMs)} in total`} className="rounded-full" style={{ width: size, height: size }}>
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-[14%] rounded-full opacity-90 dark:opacity-100"
              style={{ background: "radial-gradient(closest-side, var(--glow), transparent 72%)" }}
            />
            {ring.form === "rings" ? <Rings model={model} size={size} active={ix.active} surface={ix.surface} /> : <Spokes model={model} kind={kind} size={size} active={ix.active} surface={ix.surface} />}
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center" aria-live="polite">
              <div className="grid justify-items-center gap-1" style={{ maxWidth: size * HOLE * 2 }}>
                {active ? (
                  <>
                    <span className="type-eyebrow text-muted-foreground">{datumLabel(active, today)}</span>
                    <span className="font-display font-semibold tracking-tight whitespace-nowrap tabular" style={{ fontSize: fitFont(formatDuration(active.netMs), size, 0.095) }}>
                      {formatDuration(active.netMs)}
                    </span>
                    <span className="text-2xs text-muted-foreground tabular">{active.breakMs ? `${formatDuration(active.breakMs)} breaks` : "No breaks"}</span>
                  </>
                ) : (
                  <>
                    <span className="type-eyebrow text-muted-foreground">Net worked</span>
                    <span className="font-display leading-none font-semibold tracking-tight whitespace-nowrap tabular" style={{ fontSize: fitFont(formatDuration(summary.netMs), size, 0.115) }}>
                      {formatDuration(summary.netMs)}
                    </span>
                    <span className="text-2xs text-muted-foreground">{label}</span>
                  </>
                )}
              </div>
            </div>
          </ChartSurface>
          <div className="mt-3 flex min-h-10 items-center">
            {(() => {
              const ids = active ? active.sessionIds : summary.sessionIds;
              const href = sessionsHref(ids, active ? undefined : model.range);
              if (!href) return <span className="text-xs text-muted-foreground">{active ? "No time on this day" : null}</span>;
              return (
                <Button asChild variant="soft" size="sm">
                  <Link href={href}>
                    {active ? `View ${datumLabel(active, today)}` : `View ${plural(ids.length, "session")}`}
                    <ArrowRightIcon aria-hidden />
                  </Link>
                </Button>
              );
            })()}
          </div>
        </div>
      )}

      <dl className="grid w-full grid-cols-3 gap-2">
        <Chip label="Breaks" value={formatDuration(summary.breakMs)} />
        <Chip label="Days worked" value={String(summary.daysWorked)} />
        <Chip label="Avg per day" value={formatDuration(avg)} />
      </dl>
      {differs ? (
        <p className="w-full text-xs text-muted-foreground">
          {model.mode === "calendar" ? "Grouped by start date" : "Allocated to calendar days"}, this range holds{" "}
          <span className="font-medium text-foreground tabular">{formatDuration(model.otherMode.netMs)}</span>: a shift crosses the edge of the range. Over all your
          sessions the two always add up to the same total.
        </p>
      ) : null}
      {ring.referenceMs ? (
        <p className="flex w-full items-center gap-2 text-2xs text-muted-foreground">
          {ring.form === "rings" ? (
            <>
              <svg width="12" height="12" aria-hidden className="shrink-0">
                <circle cx="6" cy="6" r="4.5" className="fill-none stroke-brand" strokeWidth="2" />
              </svg>
              A full ring is your {formatDuration(ring.referenceMs)} goal
            </>
          ) : (
            <>
              <svg width="18" height="6" aria-hidden className="shrink-0">
                <line x1="0" x2="18" y1="3" y2="3" className="stroke-foreground/55" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>
              Dashed circle: your {formatDuration(ring.referenceMs)} goal
            </>
          )}
        </p>
      ) : null}
    </Card>
  );
}

/** Largest font (≤ ratio × size) at which `text` fits across the ring's hole. */
function fitFont(text: string, size: number, ratio: number): number {
  const room = size * HOLE * 2 * 0.86;
  return Math.round(Math.min(size * ratio, room / Math.max(1, text.length * 0.54)));
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-control bg-raised px-3 py-2.5">
      <dt className="truncate text-2xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-base font-semibold tabular">{value}</dd>
    </div>
  );
}

type Surface = ReturnType<typeof useChartInteraction>["surface"];

function Rings({ model, size, active, surface }: { model: InsightsModel; size: number; active: number | null; surface: Surface }) {
  const { ring } = model;
  const tracks = ringTracks(ring.data.length, size);
  const c = size / 2;
  const outer = size / 2 - 2;
  const hole = size * HOLE;
  const refFraction = ring.referenceMs ? ring.referenceMs / ring.scaleMs : 1;
  const refAngle = refFraction < 0.98 ? refFraction * 2 * Math.PI : null;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="relative block touch-manipulation overflow-visible"
      role="presentation"
      {...surface((x, y) => ringAt(x, y, size, tracks))}
    >
      {tracks.map((t) => {
        const d = ring.data[t.index];
        const dim = active !== null && active !== t.index;
        return (
          <g key={d.key} transform={`rotate(-90 ${c} ${c})`}>
            <circle cx={c} cy={c} r={t.r} className="fill-none stroke-track" strokeWidth={t.stroke} />
            {d.netMs > 0 ? (
              <circle
                cx={c}
                cy={c}
                r={t.r}
                strokeWidth={t.stroke}
                strokeDasharray={t.circumference}
                strokeDashoffset={ringOffset(t, d.netMs, ring.scaleMs)}
                strokeLinecap="round"
                className={cn("fill-none stroke-brand transition-opacity duration-150", dim && "opacity-35", d.isToday && "dark:drop-shadow-[0_0_6px_var(--glow)]")}
              />
            ) : null}
          </g>
        );
      })}
      {ring.data.length > 1
        ? tracks.map((t) => {
            const d = ring.data[t.index];
            return (
              <text
                key={`l-${d.key}`}
                x={c - 7}
                y={c - t.r}
                dy="0.35em"
                textAnchor="end"
                className={cn("fill-muted-foreground font-medium", d.isToday && "fill-foreground font-semibold")}
                style={{ fontSize: Math.max(8, Math.min(11, t.stroke + 1)) }}
              >
                {weekdayShort(d.from).slice(0, 1)}
              </text>
            );
          })
        : null}
      {refAngle !== null ? (
        <line
          {...(() => {
            const a = polar(c, c, hole - 2, refAngle);
            const b = polar(c, c, outer + 2, refAngle);
            return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
          })()}
          className="stroke-foreground/55"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

const MONTH_INITIAL = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function Spokes({ model, kind, size, active, surface }: { model: InsightsModel; kind: RangeKind; size: number; active: number | null; surface: Surface }) {
  const { ring } = model;
  const labelled = kind === "year" || kind === "month";
  const layout = spokeLayout(
    ring.data.map((d) => d.netMs),
    ring.scaleMs,
    size,
    labelled ? 18 : 3,
  );
  const c = size / 2;
  const refR = ring.referenceMs ? layout.r0 + (layout.r1 - layout.r0) * Math.min(1, ring.referenceMs / ring.scaleMs) : null;
  const labels = labelled
    ? ring.data
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => (kind === "year" ? d.from.endsWith("-01") : ["01", "08", "15", "22", "29"].includes(d.from.slice(8, 10))))
    : [];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative block touch-manipulation overflow-visible" role="presentation" {...surface((x, y) => spokeAt(x, y, size, ring.data.length))}>
      {layout.spokes.map((s) => (
        <line key={`t-${s.index}`} x1={s.x0} y1={s.y0} x2={s.xt} y2={s.yt} className="stroke-track" strokeWidth={layout.width} strokeLinecap="round" />
      ))}
      {refR !== null ? <circle cx={c} cy={c} r={refR} className="fill-none stroke-foreground/45" strokeWidth={1.25} strokeDasharray="3 4" /> : null}
      {layout.spokes.map((s) => {
        const d = ring.data[s.index];
        if (!(s.length > 0)) return null;
        const dim = active !== null && active !== s.index;
        return (
          <line
            key={`v-${s.index}`}
            x1={s.x0}
            y1={s.y0}
            x2={s.x1}
            y2={s.y1}
            strokeWidth={active === s.index ? layout.width + 1.5 : layout.width}
            strokeLinecap="round"
            className={cn("stroke-brand", dim && "opacity-40", d.isToday && "dark:drop-shadow-[0_0_5px_var(--glow)]")}
          />
        );
      })}
      {labels.map(({ d, i }) => {
        const angle = ((i + 0.5) / ring.data.length) * 2 * Math.PI;
        const p = polar(c, c, size / 2 - 6, angle);
        return (
          <text key={`m-${d.key}`} x={p.x} y={p.y} dy="0.35em" textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium">
            {kind === "year" ? MONTH_INITIAL[Number(d.from.slice(5, 7)) - 1] : Number(d.from.slice(8, 10))}
          </text>
        );
      })}
    </svg>
  );
}
