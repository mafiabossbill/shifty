import * as React from "react";
import Link from "next/link";
import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface StatDelta {
  /** Already formatted, with its sign, e.g. "+2h 10m" or "−4%". */
  value: string;
  direction: "up" | "down" | "flat";
  /**
   * Whether the change is good or bad news. Defaults to neutral: more hours is not "better" in SHIFTY,
   * so hours deltas stay grey; use positive/negative only where the meaning is clear (breaks taken, streak).
   */
  sentiment?: "positive" | "negative" | "neutral";
  /** What it is compared with, e.g. "vs last week". */
  label?: string;
}

const SENTIMENT = {
  positive: "text-emerald-700",
  negative: "text-red-700",
  neutral: "text-muted-foreground",
} as const;

const ARROWS = { up: ArrowUpRightIcon, down: ArrowDownRightIcon, flat: ArrowRightIcon } as const;

export interface StatTileProps {
  label: string;
  /** Already formatted, e.g. "15h 30m". Missing data is "—", never 0. */
  value: React.ReactNode;
  /** Small unit after the value, e.g. "sessions". */
  unit?: string;
  delta?: StatDelta;
  /** One short line under the value, e.g. "Goal 16h". */
  hint?: React.ReactNode;
  /** The rows behind the number: a figure links to what it counts. */
  href?: string;
  className?: string;
}

/**
 * A key figure (design standard §13): a quiet label, the value, and optionally the change against
 * the previous period with a sign and an arrow, coloured only when it is clearly good or bad.
 * No box of its own: several tiles sit side by side in a grid, inside one region. With `href` the
 * whole tile opens the rows behind the number.
 */
export function StatTile({ label, value, unit, delta, hint, href, className }: StatTileProps) {
  const Arrow = delta ? ARROWS[delta.direction] : null;
  const body = (
    <>
      <span className="flex items-center gap-0.5 text-caption text-muted-foreground">
        <span className="truncate">{label}</span>
        {href ? <ChevronRightIcon className="size-3 shrink-0" aria-hidden /> : null}
      </span>
      <span className="flex items-baseline gap-1">
        <span className={cn("text-display font-semibold tracking-tight tabular-nums", href && "group-hover:underline")}>{value}</span>
        {unit ? <span className="text-muted-foreground">{unit}</span> : null}
      </span>
      {delta || hint ? (
        <span className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
          {delta && Arrow ? (
            <span className={cn("inline-flex items-center gap-0.5", SENTIMENT[delta.sentiment ?? "neutral"])}>
              <Arrow className="size-3" aria-hidden />
              <span className="tabular-nums">{delta.value}</span>
            </span>
          ) : null}
          {delta?.label ? <span>{delta.label}</span> : null}
          {hint ? <span>{hint}</span> : null}
        </span>
      ) : null}
    </>
  );
  const classes = cn("grid min-w-0 content-start gap-1", className);
  return href ? (
    <Link href={href} className={cn(classes, "group rounded-md")}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
