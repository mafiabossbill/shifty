/**
 * Point-in-time location, asked only at an explicit clock-in/out or retry (never in the background).
 * The result is truthful: coordinates only when the device gave them, otherwise the reason.
 */
import type { LocationEvent, LocationFix, LocationStatus } from "@/lib/shifts/types";

import { matchPlace, type PlaceLike } from "./places";

export interface CaptureOptions {
  event: LocationEvent;
  /** The instant we asked (the clock-in/out time) — recorded, never used to move the session. */
  requestedAt: number;
  timeoutMs?: number;
  places?: readonly PlaceLike[];
  /** Injected for tests. */
  geolocation?: Geolocation | null;
  secure?: boolean;
}

export type CaptureResult = Omit<LocationFix, "id">;

function failed(opts: CaptureOptions, status: Exclude<LocationStatus, "captured">): CaptureResult {
  return { event: opts.event, status, requestedAt: opts.requestedAt, capturedAt: null, latitude: null, longitude: null, accuracyM: null, placeLabel: null };
}

export async function captureLocation(opts: CaptureOptions): Promise<CaptureResult> {
  const geo = opts.geolocation !== undefined ? opts.geolocation : typeof navigator !== "undefined" ? (navigator.geolocation ?? null) : null;
  const secure = opts.secure ?? (typeof window !== "undefined" ? window.isSecureContext : true);
  if (!secure) return failed(opts, "insecure");
  if (!geo) return failed(opts, "unsupported");
  return new Promise<CaptureResult>((resolve) => {
    const timeoutMs = opts.timeoutMs ?? 15_000;
    // Belt and braces: some browsers never call back when the prompt is ignored.
    const guard = setTimeout(() => resolve(failed(opts, "timeout")), timeoutMs + 2_000);
    geo.getCurrentPosition(
      (pos) => {
        clearTimeout(guard);
        const latitude = Math.round(pos.coords.latitude * 1e6) / 1e6;
        const longitude = Math.round(pos.coords.longitude * 1e6) / 1e6;
        const accuracyM = Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null;
        resolve({
          event: opts.event,
          status: "captured",
          requestedAt: opts.requestedAt,
          capturedAt: Math.round(pos.timestamp || Date.now()),
          latitude,
          longitude,
          accuracyM,
          placeLabel: matchPlace(latitude, longitude, accuracyM, opts.places ?? [])?.label ?? null,
        });
      },
      (err) => {
        clearTimeout(guard);
        resolve(failed(opts, err.code === 1 ? "denied" : err.code === 3 ? "timeout" : "unavailable"));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

export const LOCATION_STATUS_COPY: Record<LocationStatus, string> = {
  captured: "Location captured",
  denied: "Location not captured — permission was denied. You can allow it in your browser settings and retry.",
  unavailable: "Location not captured — your device couldn't get a position.",
  timeout: "Location not captured — it took too long. Try again outdoors or near a window.",
  unsupported: "Location not captured — this browser can't share location.",
  off: "Location is off in Settings.",
  insecure: "Location needs a secure (https) connection.",
};
