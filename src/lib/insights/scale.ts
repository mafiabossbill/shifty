/**
 * Scales and ticks for hand-built SVG charts. Every function is total: empty or zero data gives a finite,
 * drawable scale (never NaN, never a zero-height domain).
 */
const H = 3_600_000;

/** Hour steps a reader can add up in their head. */
const HOUR_STEPS = [0.25, 0.5, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 40, 50, 80, 100, 200, 250, 500, 1000, 2000, 5000];

export interface HourScale {
  /** Domain top in ms (a whole number of steps, ≥ one step). */
  maxMs: number;
  stepMs: number;
  /** Tick values in ms, from 0 to maxMs inclusive. */
  ticks: number[];
}

/** A 0-based hours scale with at most `maxTicks` intervals (default 4) that covers `valueMs`. */
export function hourScale(valueMs: number, maxTicks = 4): HourScale {
  const v = Number.isFinite(valueMs) && valueMs > 0 ? valueMs / H : 0;
  const step = HOUR_STEPS.find((s) => Math.ceil(v / s) <= maxTicks) ?? HOUR_STEPS[HOUR_STEPS.length - 1];
  const count = Math.max(1, Math.ceil(v / step));
  const ticks = Array.from({ length: count + 1 }, (_, i) => i * step * H);
  return { maxMs: count * step * H, stepMs: step * H, ticks };
}

/** Linear map from [d0, d1] to [r0, r1]; a flat domain maps to r0. */
export function linear(d0: number, d1: number, r0: number, r1: number) {
  const span = d1 - d0;
  return (v: number) => (span === 0 || !Number.isFinite(v) ? r0 : r0 + ((v - d0) / span) * (r1 - r0));
}

/** Compact hours label for an axis: "0", "4h", "12h", "1.5h". */
export function hourTick(ms: number): string {
  if (ms === 0) return "0";
  const h = ms / H;
  return `${Number.isInteger(h) ? h : Math.round(h * 10) / 10}h`;
}

/** Every k-th index so labels at least `minGap` px apart fit in `step` px slots. Always includes 0. */
export function labelEvery(count: number, step: number, minGap: number): number {
  if (count <= 0 || !(step > 0)) return 1;
  return Math.max(1, Math.ceil(minGap / step));
}

export function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/** Safe ratio: 0 when the denominator is 0 or either side isn't finite. */
export function ratio(a: number, b: number): number {
  return b > 0 && Number.isFinite(a) && Number.isFinite(b) ? a / b : 0;
}
