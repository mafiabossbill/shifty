import * as React from "react";
import Link from "next/link";
import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface StatDelta {
  /** Already formatted, e.g. "+2h 10m" or "−4%". */
  value: string;
  direction: "up" | "down" | "flat";
  /**
   * Whether the change is good news. Defaults to neutral: more hours is not "better" in SHIFTY,
   * so hours deltas stay neutral; use positive/negative only where the meaning is clear (breaks taken, streak).
   */
  sentiment?: "positive" | "negative" | "neutral";
  /** Screen-reader context, e.g. "vs last week". Shown after the value too. */
  label?: string;
}

const SENTIMENT = {
  positive: "bg-success-soft text-success-ink",
  negative: "bg-danger-soft text-danger-ink",
  neutral: "bg-raised text-muted-foreground",
} as const;

const ARROWS = { up: ArrowUpRightIcon, down: ArrowDownRightIcon, flat: ArrowRightIcon } as const;

export interface StatTileProps {
  label: string;
  /** Already formatted, e.g. "15h 30m". */
  value: React.ReactNode;
  /** Small unit after the value, e.g. "h" or "sessions". */
  unit?: string;
  delta?: StatDelta;
  /** One short line under the value, e.g. "Goal 16h". */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  /** The rows behind the number (numbers link to what they count). */
  href?: string;
  /** "card" sits on the page; "raised" sits inside another card. */
  variant?: "card" | "raised";
  className?: string;
}

/** A labelled number: label, big value (Outfit, tabular), optional delta and hint. */
export function StatTile({ label, value, unit, delta, hint, icon, href, variant = "card", className }: StatTileProps) {
  const Arrow = delta ? ARROWS[delta.direction] : null;
  const body = (
    <>
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon ? <span className="text-brand [&_svg]:size-4" aria-hidden>{icon}</span> : null}
        <span className="type-eyebrow truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="type-stat">{value}</span>
        {unit ? <span className="text-sm font-medium text-muted-foreground">{unit}</span> : null}
      </div>
      {delta || hint ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {delta && Arrow ? (
            <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 font-medium", SENTIMENT[delta.sentiment ?? "neutral"])}>
              <Arrow className="size-3.5" aria-hidden />
              <span className="tabular">{delta.value}</span>
              {delta.label ? <span className="sr-only"> {delta.label}</span> : null}
            </span>
          ) : null}
          {delta?.label ? <span aria-hidden>{delta.label}</span> : null}
          {hint ? <span>{hint}</span> : null}
        </div>
      ) : null}
    </>
  );
  const classes = cn(
    "grid min-w-0 content-start gap-2 rounded-card p-4 lg:p-5",
    variant === "card" ? "border border-border bg-card shadow-card" : "bg-raised",
    href && "transition-colors hover:border-border-strong focus-ring",
    className,
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
