/** Half-open intervals [start, end) on epoch milliseconds. Pure, integer arithmetic only. */
export interface Interval {
  start: number;
  end: number;
}

export function duration(interval: Interval): number {
  return Math.max(0, interval.end - interval.start);
}

export function totalDuration(intervals: readonly Interval[]): number {
  let sum = 0;
  for (const i of intervals) sum += duration(i);
  return sum;
}

/** The part of `interval` inside `bounds`, or null when they don't overlap. */
export function clip(interval: Interval, bounds: Interval): Interval | null {
  const start = Math.max(interval.start, bounds.start);
  const end = Math.min(interval.end, bounds.end);
  return end > start ? { start, end } : null;
}

/** Sorted, non-overlapping, non-adjacent cover of the inputs (empty intervals dropped). */
export function union(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ start: i.start, end: i.end });
  }
  return out;
}

/** `base` minus the union of `cuts`: what is left, in order. Never subtracts the same time twice. */
export function subtract(base: Interval, cuts: readonly Interval[]): Interval[] {
  if (base.end <= base.start) return [];
  const out: Interval[] = [];
  let cursor = base.start;
  for (const cut of union(cuts)) {
    if (cut.end <= cursor) continue;
    if (cut.start >= base.end) break;
    if (cut.start > cursor) out.push({ start: cursor, end: cut.start });
    cursor = Math.max(cursor, cut.end);
    if (cursor >= base.end) break;
  }
  if (cursor < base.end) out.push({ start: cursor, end: base.end });
  return out;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}
