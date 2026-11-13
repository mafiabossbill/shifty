import { cn } from "@/lib/utils";

export interface ProgressBarProps {
  /** Progress toward the goal, 0..1. At 1 or more the goal part is full (a goal, not a limit). */
  value: number;
  /** Time beyond the goal as a fraction of the goal (4h over a 16h goal = 0.25). Drawn as a second, lighter part. */
  overage?: number;
  /** Accessible name, e.g. "Net worked: 12h 30m of 16h goal". Required: the bar is not decoration. */
  label: string;
  /** Read out instead of the percentage, e.g. "78 percent, 3h 30m to go". */
  valueText?: string;
  className?: string;
}

function clamp(n: number, max: number) {
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
}

/**
 * Bar geometry (pure, unit-tested). Up to the goal the bar's full width is the goal. Past it, the
 * width is goal + overage: the goal part shrinks to make room and the overage part follows it, so
 * "how far past" is read off the same bar. Overage is capped at 1× the goal for drawing.
 */
export function barGeometry({ value, overage = 0 }: { value: number; overage?: number }) {
  const progress = clamp(value, 1);
  const over = progress >= 1 ? clamp(overage, 1) : 0;
  const total = 1 + over;
  return { progress, over, goalPercent: (progress / total) * 100, overPercent: (over / total) * 100 };
}

/**
 * Progress toward a goal as a plain bar (Home's goal, a session's recap). It answers one question:
 * how much of the goal is done, and how far past it. Greys only: more hours is not better or worse,
 * so neither part takes a status colour. Put the figures in words next to it ("9h 12m of 16h").
 * Replaces the goal ring (design standard §13: no rings or gauges).
 */
export function ProgressBar({ value, overage = 0, label, valueText, className }: ProgressBarProps) {
  const g = barGeometry({ value, overage });
  const part = "h-full motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(g.progress * 100)}
      aria-valuetext={valueText}
      className={cn("flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-neutral-200", className)}
    >
      <div className={cn(part, "bg-neutral-800")} style={{ width: `${g.goalPercent}%` }} />
      {g.over > 0 ? <div className={cn(part, "bg-neutral-500")} style={{ width: `${g.overPercent}%` }} /> : null}
    </div>
  );
}
