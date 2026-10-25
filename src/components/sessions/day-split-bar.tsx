import { formatDate, formatDuration } from "@/lib/format";
import type { DaySplit } from "@/lib/sessions/geometry";
import { cn } from "@/lib/utils";

/** Hatched stripes for break time (a gap in the band, not a colour). */
export const BREAK_HATCH = "repeating-linear-gradient(-45deg, var(--border-strong) 0 1.5px, transparent 1.5px 4px)";

export function splitLabel(split: DaySplit): string {
  const days = split.days.map((d) => `${formatDate(d.date)} ${formatDuration(d.netMs)}`).join(", ");
  const breakMs = split.days.reduce((s, d) => s + d.breakMs, 0);
  return breakMs > 0 ? `${days}; ${formatDuration(breakMs)} break` : days;
}

/**
 * One connected band from clock-in to clock-out, segmented at local midnights: each day's width is the
 * time it holds; breaks are hatched gaps. Alternate days use two tints of the accent.
 */
export function DaySplitBar({ split, className }: { split: DaySplit; className?: string }) {
  const pct = (f: number) => `${(f * 100).toFixed(3)}%`;
  return (
    <div role="img" aria-label={splitLabel(split)} className={cn("relative h-2 w-full overflow-hidden rounded-full bg-track", className)}>
      {split.days.map((d, i) => (
        <span
          key={d.date}
          className={cn("absolute inset-y-0", i % 2 === 0 ? "bg-brand" : "bg-brand/55", split.running && i === split.days.length - 1 && "bg-brand/80")}
          style={{ left: pct(d.startFrac), width: pct(d.endFrac - d.startFrac) }}
        />
      ))}
      {split.parts
        .filter((p) => p.kind === "break")
        .map((p) => (
          <span
            key={p.start}
            className="absolute inset-y-0 bg-card"
            style={{ left: pct(p.startFrac), width: `max(2px, ${pct(p.endFrac - p.startFrac)})`, backgroundImage: BREAK_HATCH }}
          />
        ))}
      {split.boundaries.map((b) => (
        <span key={b.at} className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-card" style={{ left: pct(b.frac) }} />
      ))}
    </div>
  );
}
