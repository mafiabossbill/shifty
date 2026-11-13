import * as React from "react";

import { cn } from "@/lib/utils";

export interface ProgressRingProps {
  /** Progress toward the goal, 0..1. Values above 1 are drawn as a full ring. */
  value: number;
  /** Time beyond the goal as a fraction of the goal, drawn as a thinner inner arc. Capped at 1 for drawing. */
  overage?: number;
  /** Accessible name, e.g. "Net worked: 12h 30m of 16h goal". */
  label: string;
  /** Read out instead of the percentage, e.g. "78 percent, 3h 30m to go". */
  valueText?: string;
  /** Diameter in px (the SVG scales with its box if you also set a width class). Default 232. */
  size?: number;
  /** Stroke width in px. Default ~7.5% of the size. */
  thickness?: number;
  /** Centre content. */
  children?: React.ReactNode;
  className?: string;
}

function clamp01(n: number) {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/** Ring geometry (pure, unit-tested): the goal arc is capped at 100%; overage is its own inner arc. */
export function ringGeometry({ value, overage = 0, size, thickness }: { value: number; overage?: number; size: number; thickness?: number }) {
  const progress = clamp01(value);
  const over = clamp01(overage);
  const stroke = thickness ?? Math.max(6, Math.round(size * 0.075));
  const center = size / 2;
  const radius = center - stroke / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  const innerStroke = Math.max(4, Math.round(stroke * 0.42));
  const innerRadius = radius - stroke / 2 - innerStroke / 2 - Math.max(3, stroke * 0.3);
  const innerCircumference = 2 * Math.PI * innerRadius;
  return {
    progress,
    over,
    stroke,
    center,
    radius,
    circumference,
    offset: circumference * (1 - progress),
    innerStroke,
    innerRadius,
    innerCircumference,
    innerOffset: innerCircumference * (1 - over),
  };
}

/**
 * RETIRED. The design standard (§13) has no rings or gauges: goal progress is a `ProgressBar`
 * (progress-bar.tsx) with the figures in words. This file stays only so the two screens that still
 * draw a ring compile until their lanes replace it (Home: R1, session detail: R2); then it is deleted.
 * tests/design.test.ts fails any converted file that imports it. Do not use it in new work.
 */
export function ProgressRing({ value, overage = 0, label, valueText, size = 232, thickness, children, className }: ProgressRingProps) {
  const g = ringGeometry({ value, overage, size, thickness });
  const { progress: v, over: o, stroke, center, radius, circumference, innerStroke, innerRadius, innerCircumference } = g;
  const arcClass = "fill-none [stroke-linecap:round] motion-safe:transition-[stroke-dashoffset] motion-safe:duration-300 motion-safe:ease-out";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={valueText}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, maxWidth: "100%", aspectRatio: "1" }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 size-full -rotate-90 overflow-visible" aria-hidden>
        <circle cx={center} cy={center} r={radius} className="fill-none stroke-neutral-200" strokeWidth={stroke} />
        {v > 0 ? (
          <circle cx={center} cy={center} r={radius} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={g.offset} className={cn(arcClass, "stroke-neutral-800")} />
        ) : null}
        {o > 0 ? (
          <circle
            cx={center}
            cy={center}
            r={innerRadius}
            strokeWidth={innerStroke}
            strokeDasharray={innerCircumference}
            strokeDashoffset={g.innerOffset}
            className={cn(arcClass, "stroke-neutral-500")}
          />
        ) : null}
      </svg>
      {children ? <div className="relative z-10 grid place-items-center text-center">{children}</div> : null}
    </div>
  );
}
