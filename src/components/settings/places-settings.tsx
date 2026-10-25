"use client";

import * as React from "react";
import { LocateFixedIcon, MapPinIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatInstant } from "@/lib/format";
import { captureLocation, LOCATION_STATUS_COPY } from "@/lib/geo/capture";
import { distanceM } from "@/lib/geo/places";
import { locationPoints, type LocationPoint } from "@/lib/settings/locations";
import type { Place } from "@/lib/shifts/profile";
import { newUuid } from "@/lib/store/store";
import { useShift, useShiftStore } from "@/lib/store/react";

import { SettingsGroup, SettingsHeader, SettingsSkeleton } from "./parts";

const RADII = [50, 100, 200, 500, 1000];
const radiusLabel = (m: number) => (m >= 1000 ? `${m / 1000} km` : `${m} m`);

interface Draft {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  source: string;
}

export function PlacesSettings() {
  const view = useShift();
  const store = useShiftStore();
  const confirm = useConfirm();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [locating, setLocating] = React.useState(false);
  const [locateError, setLocateError] = React.useState<string | null>(null);

  const places = React.useMemo(() => [...view.profile.places].sort((a, b) => a.label.localeCompare(b.label)), [view.profile.places]);
  // Recent captured fixes not already inside a remembered place: quick "save as a place".
  const suggestions = React.useMemo(() => {
    const out: LocationPoint[] = [];
    for (const p of locationPoints(view.sessions)) {
      if (places.some((pl) => distanceM(p.latitude, p.longitude, pl.latitude, pl.longitude) <= pl.radiusM)) continue;
      if (out.some((o) => distanceM(p.latitude, p.longitude, o.latitude, o.longitude) <= 100)) continue;
      out.push(p);
      if (out.length >= 5) break;
    }
    return out;
  }, [view.sessions, places]);

  if (!view.ready) return <SettingsSkeleton rows={3} />;
  const clock = view.profile.settings.clock;

  async function locateHere() {
    setLocating(true);
    setLocateError(null);
    try {
      const fix = await captureLocation({ event: "retry", requestedAt: store.now(), places: view.profile.places });
      if (fix.status !== "captured" || fix.latitude === null || fix.longitude === null) {
        setLocateError(LOCATION_STATUS_COPY[fix.status]);
        return;
      }
      setDraft({ latitude: fix.latitude, longitude: fix.longitude, accuracyM: fix.accuracyM, source: "Your current location" });
    } finally {
      setLocating(false);
    }
  }

  async function save(place: Omit<Place, "updatedAt">) {
    try {
      await store.savePlace(place);
      return true;
    } catch (e) {
      toast.error((e as Error).message || "Couldn't save the place. Try again.");
      return false;
    }
  }

  async function remove(place: Place) {
    const ok = await confirm({
      title: `Forget “${place.label}”?`,
      description: "New sessions here won't be labelled. Sessions already labelled keep their label.",
      confirmLabel: "Forget place",
      destructive: true,
    });
    if (!ok) return;
    try {
      await store.removePlace(place.id);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't remove the place. Try again.");
    }
  }

  return (
    <div className="grid gap-8">
      <SettingsHeader
        title="Places"
        description="Name the places you work. When a clock-in's location falls inside one, the session is labelled with it — matched on this device, never sent to a map service."
      />

      <SettingsGroup title="Remembered places" id="places">
        {places.length === 0 ? (
          <EmptyState variant="inline" icon={<MapPinIcon />} title="No places yet. Add one where you are now." />
        ) : (
          places.map((p) => <PlaceRow key={p.id} place={p} onSave={save} onRemove={() => void remove(p)} />)
        )}
      </SettingsGroup>

      <section className="grid gap-3">
        {draft ? (
          <NewPlace
            draft={draft}
            onCancel={() => setDraft(null)}
            onSave={async (label, radiusM) => {
              if (await save({ id: newUuid(), label, latitude: draft.latitude, longitude: draft.longitude, radiusM })) {
                toast.success(`Saved “${label}”.`);
                setDraft(null);
              }
            }}
          />
        ) : (
          <div className="grid gap-2">
            <Button variant="soft" className="w-fit" onClick={() => void locateHere()} disabled={locating}>
              <LocateFixedIcon />
              {locating ? "Finding you…" : "Use my current location"}
            </Button>
            {locateError ? (
              <p role="alert" className="text-sm text-danger-ink">
                {locateError}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Asked once, right now. SHIFTY never tracks you in the background.</p>
            )}
          </div>
        )}
      </section>

      {suggestions.length > 0 && !draft ? (
        <SettingsGroup title="From your sessions" description="Places you clocked in that don't have a name yet." id="suggestions">
          {suggestions.map((p) => (
            <div key={p.fixId} className="flex min-h-14 items-center gap-3 py-3">
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate text-sm font-medium">{p.sessionTitle}</span>
                <span className="text-xs text-muted-foreground">
                  {formatInstant(p.at, p.reportingTimeZone, clock)}
                  {p.accuracyM !== null ? ` · ±${p.accuracyM} m` : ""}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDraft({ latitude: p.latitude, longitude: p.longitude, accuracyM: p.accuracyM, source: `Where “${p.sessionTitle}” started` })}
              >
                <PlusIcon />
                Save as place
              </Button>
            </div>
          ))}
        </SettingsGroup>
      ) : null}
    </div>
  );
}

function PlaceRow({ place, onSave, onRemove }: { place: Place; onSave: (p: Omit<Place, "updatedAt">) => Promise<boolean>; onRemove: () => void }) {
  const [label, setLabel] = React.useState(place.label);
  const [error, setError] = React.useState<string | null>(null);
  const radii = RADII.includes(place.radiusM) ? RADII : [...RADII, place.radiusM].sort((a, b) => a - b);
  const commitLabel = () => {
    const next = label.trim();
    if (!next) {
      setError("Give the place a name.");
      return;
    }
    setError(null);
    if (next !== place.label) void onSave({ ...place, label: next.slice(0, 40) });
  };
  return (
    <div className="grid gap-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-start sm:gap-3">
      <div className="grid gap-1">
        <label htmlFor={`place-${place.id}`} className="sr-only">
          Place name
        </label>
        <Input
          id={`place-${place.id}`}
          value={label}
          maxLength={40}
          aria-invalid={Boolean(error)}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => e.key === "Enter" && commitLabel()}
        />
        {error ? <p className="text-xs font-medium text-danger-ink">{error}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={`radius-${place.id}`} className="sr-only">
          Radius
        </label>
        <Select id={`radius-${place.id}`} value={String(place.radiusM)} onChange={(e) => void onSave({ ...place, radiusM: Number(e.target.value) })}>
          {radii.map((r) => (
            <option key={r} value={r}>
              Within {radiusLabel(r)}
            </option>
          ))}
        </Select>
        <Button variant="ghost" size="icon" aria-label={`Forget ${place.label}`} onClick={onRemove} className="sm:hidden">
          <Trash2Icon />
        </Button>
      </div>
      <Button variant="ghost" size="icon" aria-label={`Forget ${place.label}`} onClick={onRemove} className="max-sm:hidden">
        <Trash2Icon />
      </Button>
    </div>
  );
}

function NewPlace({ draft, onSave, onCancel }: { draft: Draft; onSave: (label: string, radiusM: number) => Promise<void>; onCancel: () => void }) {
  const [label, setLabel] = React.useState("");
  const [radius, setRadius] = React.useState(draft.accuracyM !== null && draft.accuracyM > 100 ? 200 : 100);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <form
      className="grid gap-4 rounded-card border border-brand/40 bg-card p-4 shadow-card sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const next = label.trim();
        if (!next) return setError("Give the place a name, like Office or Site B.");
        setError(null);
        void onSave(next.slice(0, 40), radius);
      }}
    >
      <div className="grid gap-0.5">
        <h2 className="font-display text-base font-semibold">New place</h2>
        <p className="text-xs text-muted-foreground">
          {draft.source}
          {draft.accuracyM !== null ? ` · accurate to about ${draft.accuracyM} m` : ""}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <Field label="Name" htmlFor="new-place-name" error={error}>
          <Input id="new-place-name" value={label} maxLength={40} autoFocus placeholder="Office" aria-invalid={Boolean(error)} aria-describedby={error ? "new-place-name-error" : undefined} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Radius" htmlFor="new-place-radius">
          <Select id="new-place-radius" value={String(radius)} onChange={(e) => setRadius(Number(e.target.value))}>
            {RADII.map((r) => (
              <option key={r} value={r}>
                Within {radiusLabel(r)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save place</Button>
      </div>
    </form>
  );
}
