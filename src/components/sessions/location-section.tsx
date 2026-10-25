"use client";

import { EyeIcon, EyeOffIcon, LocateFixedIcon, MapPinIcon, MapPinOffIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { formatInstant, type ClockFormat } from "@/lib/format";
import { LOCATION_STATUS_COPY } from "@/lib/geo/capture";
import { LOCATION_EVENT_LABEL, accuracyCopy } from "@/lib/sessions/wording";
import type { ShiftSession } from "@/lib/shifts/types";
import { useShiftStore } from "@/lib/store/react";

import { actionMessage } from "./errors";

/**
 * Every point-in-time location asked for this session, truthfully: captured points with accuracy, place and
 * capture time (coordinates only on request), and the reason when nothing was captured. Each point can be
 * deleted; the session stays.
 */
export function LocationSection({ session, clock, readOnly }: { session: ShiftSession; clock: ClockFormat; readOnly?: boolean }) {
  const store = useShiftStore();
  const confirm = useConfirm();
  const [showCoords, setShowCoords] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const zone = session.reportingTimeZone;
  const thisYear = new Date().getFullYear().toString();
  const fixes = session.locations;
  const anyCaptured = fixes.some((f) => f.status === "captured");
  const running = session.endedAt === null;

  const remove = async (fixId: string, label: string) => {
    const ok = await confirm({
      title: `Delete the ${label.toLowerCase()} location?`,
      description: "The point is removed from this device and your account. The session and its times stay as they are.",
      confirmLabel: "Delete point",
      destructive: true,
    });
    if (!ok) return;
    try {
      await store.deleteLocation(session.id, fixId);
      toast.success("Location point deleted");
    } catch (error) {
      toast.error(actionMessage(error));
    }
  };

  const retry = async () => {
    setRetrying(true);
    try {
      await store.retryLocation(session.id);
    } catch (error) {
      toast.error(actionMessage(error));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="grid gap-3">
      {fixes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No location was asked for this session.</p>
      ) : (
        <ul className="grid gap-2">
          {fixes.map((f) => {
            const captured = f.status === "captured";
            const label = LOCATION_EVENT_LABEL[f.event];
            return (
              <li key={f.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-control bg-raised p-3">
                <span className={captured ? "mt-0.5 text-brand" : "mt-0.5 text-muted-foreground"} aria-hidden>
                  {captured ? <MapPinIcon className="size-4" /> : <MapPinOffIcon className="size-4" />}
                </span>
                <div className="grid min-w-0 gap-0.5 text-sm">
                  <p className="font-medium">
                    {label}
                    {captured && f.placeLabel ? <span className="font-normal text-muted-foreground"> · {f.placeLabel}</span> : null}
                  </p>
                  <p className={captured ? "text-muted-foreground" : "text-foreground/85"}>{captured ? (accuracyCopy(f.accuracyM) ?? LOCATION_STATUS_COPY.captured) : LOCATION_STATUS_COPY[f.status]}</p>
                  <p className="text-xs text-muted-foreground tabular">
                    {captured && f.capturedAt !== null ? `Captured ${formatInstant(f.capturedAt, zone, clock, thisYear)}` : `Asked ${formatInstant(f.requestedAt, zone, clock, thisYear)}`}
                  </p>
                  {captured && showCoords && f.latitude !== null && f.longitude !== null ? (
                    <p className="font-mono text-xs break-all text-foreground/85">
                      {f.latitude.toFixed(6)}, {f.longitude.toFixed(6)}
                    </p>
                  ) : null}
                </div>
                {!readOnly ? (
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete the ${label.toLowerCase()} location`} onClick={() => remove(f.id, label)}>
                    <Trash2Icon />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {anyCaptured ? (
          <Button variant="ghost" size="sm" onClick={() => setShowCoords((v) => !v)} aria-pressed={showCoords}>
            {showCoords ? <EyeOffIcon /> : <EyeIcon />}
            {showCoords ? "Hide coordinates" : "Show coordinates"}
          </Button>
        ) : null}
        {running && !readOnly ? (
          <Button variant="soft" size="sm" onClick={retry} disabled={retrying}>
            <LocateFixedIcon />
            {retrying ? "Asking…" : "Try location again"}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">Locations stay on this device and in your account. There are no street names: places come from the spots you saved.</p>
    </div>
  );
}
