/** Remembered places, matched on the device by distance. Coordinates never go to a third party (A05). */
export interface PlaceLike {
  label: string;
  latitude: number;
  longitude: number;
  radiusM: number;
}

const EARTH_M = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The nearest place whose radius (plus a little of the fix's own uncertainty) contains the fix. */
export function matchPlace<P extends PlaceLike>(lat: number, lng: number, accuracyM: number | null, places: readonly P[]): P | null {
  let best: { place: P; d: number } | null = null;
  for (const place of places) {
    const d = distanceM(lat, lng, place.latitude, place.longitude);
    const slack = Math.min(accuracyM ?? 0, place.radiusM) / 2;
    if (d <= place.radiusM + slack && (!best || d < best.d)) best = { place, d };
  }
  return best?.place ?? null;
}

/** Rounded to ~1 km for anything shared: never exact coordinates in a share image. */
export function coarse(lat: number, lng: number): { latitude: number; longitude: number } {
  return { latitude: Math.round(lat * 100) / 100, longitude: Math.round(lng * 100) / 100 };
}
