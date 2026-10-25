"use client";

/**
 * Shared pieces for the Insights charts (one system for every chart):
 *  - useElementWidth: charts render at their real pixel width, so type stays 11–12px at any size;
 *  - useChartInteraction: hover previews (mouse), tap or click pins, arrow keys move, Esc clears;
 *  - ChartTip: the precise tooltip with exact values and a "View sessions" action;
 *  - ChartCard: title, optional headline, "Table" toggle (the text alternative), empty state and an
 *    error boundary, so one broken chart never takes the page down.
 */
import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, ChartNoAxesColumnIcon, TableIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/* ---------- sizing ---------- */

export function useElementWidth<T extends HTMLElement = HTMLDivElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width ?? 0);
      setWidth((prev) => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/* ---------- interaction ---------- */

type IndexAt = (x: number, y: number) => number | null;

export interface ChartInteraction {
  active: number | null;
  pinned: boolean;
  clear: () => void;
  /** Spread on the SVG (or the element the marks live in). */
  surface: (indexAt: IndexAt) => {
    onPointerMove: (e: React.PointerEvent<Element>) => void;
    onPointerLeave: () => void;
    onClick: (e: React.MouseEvent<Element>) => void;
  };
  /** Spread on the focusable wrapper around the surface and the tooltip. */
  container: {
    ref: React.RefObject<HTMLDivElement | null>;
    tabIndex: number;
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  };
  /** Pin a mark directly (calendar buttons). */
  pin: (index: number | null) => void;
  hover: (index: number | null) => void;
}

/**
 * Hover shows a preview with a mouse; a tap or click pins it (so the "View sessions" action can be
 * reached); arrow keys move the pinned mark (`columns` makes Up/Down jump rows in grids); Esc or a
 * tap outside clears it.
 */
export function useChartInteraction(count: number, { columns = 0, skip }: { columns?: number; skip?: (i: number) => boolean } = {}): ChartInteraction {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = React.useState<number | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const valid = (i: number | null) => (i !== null && i >= 0 && i < count && !skip?.(i) ? i : null);
  const active = valid(pinnedIndex) ?? valid(hovered);

  React.useEffect(() => {
    if (pinnedIndex === null) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPinnedIndex(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [pinnedIndex]);

  const local = (e: React.PointerEvent<Element> | React.MouseEvent<Element>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  const move = (from: number | null, delta: number) => {
    let i = from === null ? (delta > 0 ? -1 : count) : from;
    for (let guard = 0; guard < count; guard++) {
      i += delta;
      if (i < 0 || i >= count) return from;
      if (!skip?.(i)) return i;
    }
    return from;
  };

  return {
    active,
    pinned: valid(pinnedIndex) !== null,
    clear: () => {
      setPinnedIndex(null);
      setHovered(null);
    },
    pin: setPinnedIndex,
    hover: setHovered,
    surface: (indexAt) => ({
      onPointerMove: (e) => {
        if (e.pointerType !== "mouse") return;
        const [x, y] = local(e);
        setHovered(indexAt(x, y));
      },
      onPointerLeave: () => setHovered(null),
      onClick: (e) => {
        const [x, y] = local(e);
        const i = valid(indexAt(x, y));
        setPinnedIndex((p) => (i === null || p === i ? null : i));
      },
    }),
    container: {
      ref,
      tabIndex: 0,
      onKeyDown: (e) => {
        const current = active;
        let next: number | null | undefined;
        if (e.key === "ArrowRight") next = move(current, 1);
        else if (e.key === "ArrowLeft") next = move(current, -1);
        else if (e.key === "ArrowDown") next = move(current, columns || 1);
        else if (e.key === "ArrowUp") next = move(current, -(columns || 1));
        else if (e.key === "Home") next = move(null, 1);
        else if (e.key === "End") next = move(null, -1);
        else if (e.key === "Escape" && current !== null) {
          setPinnedIndex(null);
          setHovered(null);
          e.preventDefault();
          return;
        }
        if (next === undefined) return;
        e.preventDefault();
        setPinnedIndex(next);
      },
    },
  };
}

/* ---------- tooltip ---------- */

export interface TipRow {
  label: string;
  value: React.ReactNode;
  /** A small swatch before the label. */
  swatch?: "net" | "break" | "target" | "muted";
}

const TIP_WIDTH = 236;

const SWATCH = {
  net: "bg-brand",
  break: "bg-brand/30",
  target: "border border-dashed border-foreground/60 bg-transparent",
  muted: "bg-muted-foreground/40",
} as const;

/**
 * The tooltip: positioned at (x, y) inside its chart wrapper (which must be `relative`), clamped to the
 * wrapper's width. `place` above or below the anchor.
 */
export function ChartTip({
  x,
  y,
  width,
  place = "auto",
  title,
  rows,
  href,
  hrefLabel = "View sessions",
  pinned = true,
  children,
}: {
  x: number;
  y: number;
  width: number;
  /** "auto": above the anchor unless it sits near the top of the chart. */
  place?: "above" | "below" | "auto";
  title: React.ReactNode;
  rows?: TipRow[];
  href?: string | null;
  hrefLabel?: string;
  /** Hover previews let the pointer pass through (so it keeps reading the chart); pinned tips are clickable. */
  pinned?: boolean;
  children?: React.ReactNode;
}) {
  const w = Math.min(TIP_WIDTH, Math.max(160, width));
  const left = Math.max(0, Math.min(x - w / 2, width - w));
  const side = place === "auto" ? (y < 120 ? "below" : "above") : place;
  return (
    <div
      role="status"
      className={cn("absolute z-20 grid gap-2 rounded-[14px] border border-border bg-popover p-3 text-popover-foreground shadow-raised", !pinned && "pointer-events-none")}
      style={{ left, width: w, ...(side === "above" ? { bottom: `calc(100% - ${y}px + 10px)` } : { top: y + 10 }) }}
    >
      <p className="text-xs font-semibold">{title}</p>
      {rows && rows.length ? (
        <dl className="grid gap-1 text-xs">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              {r.swatch ? <span aria-hidden className={cn("size-2.5 shrink-0 rounded-[3px]", SWATCH[r.swatch])} /> : null}
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="ml-auto font-medium tabular">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
      {href && !pinned ? <p className="text-2xs text-muted-foreground">Click to {hrefLabel.toLowerCase()}</p> : null}
      {href && pinned ? (
        <Button asChild variant="soft" size="xs" className="justify-self-start">
          <Link href={href}>
            {hrefLabel}
            <ArrowRightIcon aria-hidden />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

/* ---------- error boundary ---------- */

class ChartBoundary extends React.Component<{ label: string; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(JSON.stringify({ level: "error", event: "insights.chart_failed", chart: this.props.label, message: (error as Error)?.message }));
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="grid justify-items-start gap-2 rounded-control bg-danger-soft p-4 text-sm text-danger-ink">
        <p className="flex items-center gap-2 font-medium">
          <TriangleAlertIcon className="size-4" aria-hidden />
          This chart couldn&apos;t be drawn.
        </p>
        <p className="text-danger-ink/90">Your sessions are safe. Try again, or reload the page if it keeps happening.</p>
        <Button variant="outline" size="sm" onClick={() => this.setState({ failed: false })}>
          Try again
        </Button>
      </div>
    );
  }
}

/* ---------- card ---------- */

export function ChartCard({
  title,
  description,
  action,
  headline,
  table,
  empty,
  emptyAction,
  className,
  children,
  footer,
  id,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** The card's key number(s), above the chart. */
  headline?: React.ReactNode;
  /** The text alternative (a table); the toggle only appears when given. */
  table?: React.ReactNode;
  /** One sentence when there's nothing to draw. */
  empty?: string | null;
  emptyAction?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  id?: string;
}) {
  const [asTable, setAsTable] = React.useState(false);
  const headingId = React.useId();
  return (
    <Card className={cn("min-w-0", className)} aria-labelledby={headingId} role="region" id={id}>
      <CardHeader
        action={
          action || (table && !empty) ? (
            <div className="flex items-center gap-1.5">
              {action}
              {table && !empty ? (
                <Button
                  variant="ghost"
                  size="xs"
                  aria-pressed={asTable}
                  onClick={() => setAsTable((v) => !v)}
                  className="text-muted-foreground"
                  aria-label={asTable ? `Show ${title} as a chart` : `Show ${title} as a table`}
                >
                  {asTable ? <ChartNoAxesColumnIcon aria-hidden /> : <TableIcon aria-hidden />}
                  {asTable ? "Chart" : "Table"}
                </Button>
              ) : null}
            </div>
          ) : null
        }
      >
        <CardTitle id={headingId}>{title}</CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      {headline ? <div className="-mt-1">{headline}</div> : null}
      <ChartBoundary label={title}>
        {empty ? (
          <EmptyState variant="inline" title={empty} action={emptyAction} className="py-8" />
        ) : asTable && table ? (
          <div className="max-h-80 overflow-auto rounded-control border border-border" data-scroll-area>
            {table}
          </div>
        ) : (
          children
        )}
      </ChartBoundary>
      {footer && !empty ? footer : null}
    </Card>
  );
}

/* ---------- table ---------- */

export interface Column<T> {
  label: string;
  cell: (row: T) => React.ReactNode;
  numeric?: boolean;
}

export function DataTable<T>({ caption, columns, rows, rowKey, foot }: { caption: string; columns: Column<T>[]; rows: readonly T[]; rowKey: (row: T) => string; foot?: React.ReactNode[] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <caption className="sr-only">{caption}</caption>
      <thead className="sticky top-0 bg-raised">
        <tr>
          {columns.map((c) => (
            <th key={c.label} scope="col" className={cn("px-3 py-2 font-medium text-muted-foreground", c.numeric ? "text-right" : "text-left")}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} className="border-t border-border">
            {columns.map((c, i) => {
              const Tag = i === 0 ? "th" : "td";
              return (
                <Tag key={c.label} scope={i === 0 ? "row" : undefined} className={cn("px-3 py-1.5 font-normal", c.numeric ? "text-right tabular" : "text-left")}>
                  {c.cell(row)}
                </Tag>
              );
            })}
          </tr>
        ))}
      </tbody>
      {foot ? (
        <tfoot>
          <tr className="border-t border-border-strong font-medium">
            {foot.map((f, i) => (
              <td key={i} className={cn("px-3 py-2", i === 0 ? "text-left" : "text-right tabular")}>
                {f}
              </td>
            ))}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

/** A link cell for tables: the number links to the rows behind it. */
export function DrillLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <Link href={href} className="text-brand underline-offset-2 hover:underline focus-ring rounded-sm">
      {children}
    </Link>
  );
}

/** Small legend chip. */
export function LegendItem({ kind, label }: { kind: keyof typeof SWATCH | "next"; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
      <span aria-hidden className={cn("h-2.5 w-3.5 rounded-[3px]", kind === "next" ? "bg-brand/45" : SWATCH[kind])} />
      {label}
    </span>
  );
}

/** The chart's focusable wrapper: focus ring, `relative` for the tooltip, an accessible name. */
export function ChartSurface({
  interaction,
  label,
  className,
  children,
  style,
}: {
  interaction: ChartInteraction;
  label: string;
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      {...interaction.container}
      role="group"
      aria-label={`${label}. Arrow keys read each value; Escape closes.`}
      className={cn("relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card", className)}
      style={style}
    >
      {children}
    </div>
  );
}
