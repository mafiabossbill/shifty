/** Geometry for the "Hours in motion" radial (concentric day rings or radial bars). Pure and total. */
import { clamp, ratio } from "./scale";

export interface RingTrack {
  index: number;
  r: number;
  stroke: number;
  circumference: number;
}

/** Fraction of the size kept free in the middle for the total. */
export const HOLE = 0.27;

/** Concentric rings, index 0 outermost. One ring (Today) is drawn thicker. */
export function ringTracks(n: number, size: number): RingTrack[] {
  if (n <= 0 || !(size > 0)) return [];
  const outer = size / 2 - 2;
  const hole = size * HOLE;
  const pitch = (outer - hole) / n;
  const stroke = n === 1 ? Math.min(pitch * 0.5, size * 0.085) : Math.max(3, pitch * 0.76);
  return Array.from({ length: n }, (_, index) => {
    const r = outer - stroke / 2 - index * pitch;
    return { index, r, stroke, circumference: 2 * Math.PI * r };
  });
}

/** Dash offset for a ring filled to `value / scale` (0…1). */
export function ringOffset(track: RingTrack, value: number, scale: number): number {
  return track.circumference * (1 - clamp(ratio(value, scale), 0, 1));
}

export interface Spoke {
  index: number;
  /** Radians, 0 = 12 o'clock, clockwise. */
  angle: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Full-length end (the track). */
  xt: number;
  yt: number;
  length: number;
}

export interface SpokeLayout {
  r0: number;
  r1: number;
  width: number;
  spokes: Spoke[];
}

export function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) };
}

/** Radial bars from an inner circle; bar length ∝ value / scale. */
export function spokeLayout(values: readonly number[], scale: number, size: number, outerPad = 3): SpokeLayout {
  const n = values.length;
  const c = size / 2;
  const r0 = size * HOLE + 4;
  const r1 = Math.max(r0 + 1, size / 2 - outerPad);
  const slot = n > 0 ? (2 * Math.PI * r0) / n : 0;
  const width = clamp(slot * 0.62, 1, 9);
  const spokes = values.map((v, index) => {
    const angle = ((index + 0.5) / n) * 2 * Math.PI;
    const length = (r1 - r0) * clamp(ratio(v, scale), 0, 1);
    const a = polar(c, c, r0, angle);
    const b = polar(c, c, r0 + length, angle);
    const t = polar(c, c, r1, angle);
    return { index, angle, x0: a.x, y0: a.y, x1: b.x, y1: b.y, xt: t.x, yt: t.y, length };
  });
  return { r0, r1, width, spokes };
}

/** Which spoke a point (relative to the SVG) is over: by angle, anywhere outside the hole. */
export function spokeAt(x: number, y: number, size: number, n: number): number | null {
  if (n <= 0) return null;
  const c = size / 2;
  const dx = x - c;
  const dy = y - c;
  if (Math.hypot(dx, dy) < size * HOLE * 0.8) return null;
  const angle = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI);
  return Math.min(n - 1, Math.floor((angle / (2 * Math.PI)) * n));
}

/** Which ring a point is over: by radius. */
export function ringAt(x: number, y: number, size: number, tracks: readonly RingTrack[]): number | null {
  const c = size / 2;
  const d = Math.hypot(x - c, y - c);
  let best: number | null = null;
  let bestGap = Infinity;
  for (const t of tracks) {
    const gap = Math.abs(d - t.r);
    if (gap < bestGap && gap <= Math.max(t.stroke, 6)) {
      best = t.index;
      bestGap = gap;
    }
  }
  return best;
}
