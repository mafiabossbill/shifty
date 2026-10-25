"use client";

import * as React from "react";
import Link from "next/link";
import { MapPinOffIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SwitchRow } from "@/components/ui/switch";
import { formatDate, formatTime, zoneAbbreviation } from "@/lib/format";
import { EVENT_WORDS, RETENTION_OPTIONS, locationPoints, pointsOlderThan, retentionValue } from "@/lib/settings/locations";
import { useNow, useShiftStore } from "@/lib/store/react";
import { deviceTimeZone, localDateOf } from "@/lib/time/zone";

import { SettingsGroup, SettingsHeader, SettingsSkeleton, useSaveSettings } from "./parts";
import { useReadyShift } from "./use-ready-shift";

const PAGE = 50;

export function PrivacySettings() {
  const view = useReadyShift();
  const store = useShiftStore();
  const confirm = useConfirm();
  const save = useSaveSettings();
  const now = useNow(60_000);
  const [showCoords, setShowCoords] = React.useState(false);
  const [shown, setShown] = React.useState(PAGE);
  const [busy, setBusy] = React.useState(false);
  const points = React.useMemo(() => locationPoints(Object.values(view.state.sessions)), [view.state.sessions]);
  const device = React.useMemo(() => deviceTimeZone(), []);

  if (!view.ready) return <SettingsSkeleton rows={6} />;
  const s = view.profile.settings;
  const thisYear = localDateOf(now, s.reportingTimeZone).slice(0, 4);

  async function deleteOne(sessionId: string, fixId: string) {
    try {
      await store.deleteLocation(sessionId, fixId);
      toast.success("Location point deleted.");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't delete that point. Try again.");
    }
  }

  async function deleteAll() {
    const ok = await confirm({
      title: `Delete all ${points.length} location point${points.length === 1 ? "" : "s"}?`,
      description: "Coordinates are removed from every session, here and (when synced) on your account. Sessions and their times stay. This can't be undone.",
      confirmLabel: "Delete all points",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await store.deleteAllLocations();
      toast.success("All location points deleted.");
    } catch (e) {
      toast.error((e as Error).message || "Some points couldn't be deleted. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function changeRetention(value: string) {
    const option = RETENTION_OPTIONS.find((o) => o.value === value);
    if (!option) return;
    const older = pointsOlderThan(points, option.days, store.now());
    if (older > 0) {
      const ok = await confirm({
        title: `Keep points for ${option.label.toLowerCase()}?`,
        description: `${older} point${older === 1 ? " is" : "s are"} older than that and will be deleted now. Sessions stay.`,
        confirmLabel: "Delete older points",
        destructive: true,
      });
      if (!ok) return;
    }
    if (!(await save({ locationRetentionDays: option.days }))) return;
    try {
      await store.applyRetention();
    } catch (e) {
      toast.error((e as Error).message || "Older points couldn't all be deleted. Try again.");
    }
  }

  return (
    <div className="grid gap-8">
      <SettingsHeader title="Privacy" description="Location is yours. SHIFTY only asks at the moment you clock in or out, never in the background." />

      <SettingsGroup title="When to ask for location" id="ask">
        <SwitchRow
          id="loc-in"
          title="At clock-in"
          description="One point when you tap Clock in. The start time never waits for it."
          checked={s.locationOnClockIn}
          onCheckedChange={(on) => void save({ locationOnClockIn: on })}
        />
        <SwitchRow id="loc-out" title="At clock-out" description="One point when you clock out." checked={s.locationOnClockOut} onCheckedChange={(on) => void save({ locationOnClockOut: on })} />
      </SettingsGroup>

      <SettingsGroup title="Keep location points" description="Older points are deleted automatically each time SHIFTY opens." id="retention">
        <div className="py-4">
          <SegmentedControl ariaLabel="Keep location points for" value={retentionValue(s.locationRetentionDays)} onValueChange={(v) => void changeRetention(v)} options={RETENTION_OPTIONS} fullWidth />
        </div>
      </SettingsGroup>

      <section className="grid gap-2.5" aria-labelledby="points-title">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div className="grid gap-0.5">
            <h2 id="points-title" className="font-display text-base font-semibold tracking-tight">
              Every location point
            </h2>
            <p className="text-sm text-muted-foreground">
              <span className="tabular">{points.length}</span> stored{points.length ? ", newest first" : ""}.
            </p>
          </div>
          {points.length > 0 ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" aria-pressed={showCoords} onClick={() => setShowCoords((v) => !v)}>
                {showCoords ? "Hide coordinates" : "Show coordinates"}
              </Button>
              <Button variant="danger" size="sm" disabled={busy} onClick={() => void deleteAll()}>
                Delete all
              </Button>
            </div>
          ) : null}
        </div>
        {points.length === 0 ? (
          <EmptyState icon={<MapPinOffIcon />} title="No location points are stored." />
        ) : (
          <ul className="divide-y divide-border rounded-card border border-border bg-card shadow-card">
            {points.slice(0, shown).map((p) => {
              const zone = p.reportingTimeZone;
              const abbr = zone !== device ? ` ${zoneAbbreviation(p.at, zone)}` : "";
              return (
                <li key={p.fixId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <Link href={`/sessions/view?id=${p.sessionId}`} className="truncate text-sm font-medium hover:underline focus-ring rounded">
                      {formatDate(localDateOf(p.sessionStartedAt, zone), { thisYear })} · {p.sessionTitle}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {EVENT_WORDS[p.event]} at {formatTime(p.at, zone, s.clock)}
                      {abbr}
                      {p.accuracyM !== null ? ` · ±${p.accuracyM} m` : ""}
                      {p.placeLabel ? ` · ${p.placeLabel}` : ""}
                      {p.inTrash ? " · in trash" : ""}
                    </span>
                    {showCoords ? (
                      <span className="text-xs tabular text-muted-foreground">
                        {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                      </span>
                    ) : null}
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Delete this location point" onClick={() => void deleteOne(p.sessionId, p.fixId)}>
                    <Trash2Icon />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {points.length > shown ? (
          <Button variant="secondary" className="justify-self-center" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({points.length - shown} older)
          </Button>
        ) : null}
      </section>

      <SettingsGroup title="What SHIFTY doesn't do" id="promises">
        <ul className="grid gap-2 py-4 text-sm text-muted-foreground">
          <li>No background tracking — one point at clock-in or clock-out, only if you allow it.</li>
          <li>No third-party maps or geocoding — place names come from your own Places, matched on this device.</li>
          <li>Share images never include your location.</li>
          <li>Exports can leave precise location out (Settings → Your data).</li>
        </ul>
      </SettingsGroup>
    </div>
  );
}
