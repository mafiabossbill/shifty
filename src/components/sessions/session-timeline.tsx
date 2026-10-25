import { LogInIcon, LogOutIcon, MapPinIcon, MapPinOffIcon, TimerIcon } from "lucide-react";

import { formatDate, formatDuration, formatTime, type ClockFormat } from "@/lib/format";
import { timelineItems, type DaySplit } from "@/lib/sessions/geometry";
import { BREAK_KIND_LABEL } from "@/lib/sessions/wording";
import type { LocationFix } from "@/lib/shifts/types";
import { cn } from "@/lib/utils";

import { BREAK_HATCH, splitLabel } from "./day-split-bar";

const pct = (f: number) => `${(f * 100).toFixed(3)}%`;

function pinFix(fixes: LocationFix[], event: "clock_in" | "clock_out"): LocationFix | null {
  const own = fixes.filter((f) => f.event === event);
  return own.find((f) => f.status === "captured") ?? own[own.length - 1] ?? null;
}

function FixNote({ fix, className }: { fix: LocationFix | null; className?: string }) {
  if (!fix) return null;
  const captured = fix.status === "captured";
  return (
    <span className={cn("inline-flex items-center gap-1 text-2xs text-muted-foreground", className)}>
      {captured ? <MapPinIcon className="size-3 shrink-0" aria-hidden /> : <MapPinOffIcon className="size-3 shrink-0" aria-hidden />}
      {captured ? (fix.placeLabel ?? "Location captured") : "Location not captured"}
    </span>
  );
}

/**
 * The unified timeline: one track from clock-in to clock-out (or now), local midnights marked with the
 * new date, breaks hatched. Horizontal from 768px; a vertical track on phones.
 */
export function SessionTimeline({ split, zone, clock, locations }: { split: DaySplit; zone: string; clock: ClockFormat; locations: LocationFix[] }) {
  const t = (at: number) => formatTime(at, zone, clock);
  const inFix = pinFix(locations, "clock_in");
  const outFix = split.running ? null : pinFix(locations, "clock_out");
  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        {`Clock-in ${t(split.start)}, ${split.running ? `running until now, ${t(split.end)}` : `clock-out ${t(split.end)}`}. ${splitLabel(split)}.`}
      </figcaption>
      <Horizontal split={split} t={t} inFix={inFix} outFix={outFix} />
      <Vertical split={split} t={t} inFix={inFix} outFix={outFix} />
    </figure>
  );
}

interface TrackProps {
  split: DaySplit;
  t: (at: number) => string;
  inFix: LocationFix | null;
  outFix: LocationFix | null;
}

function Horizontal({ split, t, inFix, outFix }: TrackProps) {
  return (
    <div className="hidden md:block" aria-hidden>
      <div className="flex items-start justify-between gap-4 pb-3">
        <div className="grid gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <LogInIcon className="size-3.5" /> Clock in
          </span>
          <span className="font-display text-lg font-semibold tabular">{t(split.start)}</span>
          <FixNote fix={inFix} />
        </div>
        <div className="grid justify-items-end gap-0.5 text-right">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {split.running ? <TimerIcon className="size-3.5" /> : <LogOutIcon className="size-3.5" />} {split.running ? "Now" : "Clock out"}
          </span>
          <span className={cn("font-display text-lg font-semibold tabular", split.running && "text-brand")}>{t(split.end)}</span>
          <FixNote fix={outFix} />
        </div>
      </div>
      <div className="relative pb-9">
        <div className="relative h-4 overflow-hidden rounded-full bg-track">
          {split.days.map((d, i) => (
            <span key={d.date} className={cn("absolute inset-y-0", i % 2 === 0 ? "bg-brand" : "bg-brand/55")} style={{ left: pct(d.startFrac), width: pct(d.endFrac - d.startFrac) }} />
          ))}
          {split.parts
            .filter((p) => p.kind === "break")
            .map((p) => (
              <span key={p.start} className="absolute inset-y-0 bg-card" style={{ left: pct(p.startFrac), width: `max(3px, ${pct(p.endFrac - p.startFrac)})`, backgroundImage: BREAK_HATCH }} />
            ))}
        </div>
        {/* Midnight markers: a tick through the track and the new date under it. */}
        {split.boundaries.map((b) => (
          <div
            key={b.at}
            className={cn("absolute top-[-6px] flex flex-col", b.frac < 0.12 ? "items-start" : b.frac > 0.88 ? "-translate-x-full items-end" : "-translate-x-1/2 items-center")}
            style={{ left: pct(b.frac) }}
          >
            <span className="h-7 w-0.5 rounded-full bg-foreground/70" />
            <span className="mt-1 rounded-full bg-raised px-2 py-0.5 text-2xs font-medium whitespace-nowrap text-foreground">{formatDate(b.date)}</span>
          </div>
        ))}
      </div>
      <Legend />
      <BreakList split={split} t={t} />
    </div>
  );
}

function BreakList({ split, t }: { split: DaySplit; t: (at: number) => string }) {
  const breaks = split.parts.filter((p) => p.kind === "break");
  if (breaks.length === 0) return <p className="mt-3 text-xs text-muted-foreground">No breaks in this session.</p>;
  // A break that crosses midnight is drawn as two parts; list it once.
  const merged: { start: number; end: number; kind?: string }[] = [];
  for (const p of breaks) {
    const last = merged[merged.length - 1];
    if (last && last.end === p.start) last.end = p.end;
    else merged.push({ start: p.start, end: p.end, kind: p.breakKind });
  }
  return (
    <ul className="mt-3 flex flex-wrap gap-2 text-xs">
      {merged.map((b) => (
        <li key={b.start} className="rounded-full bg-raised px-2.5 py-1 tabular">
          <span className="font-medium">
            {t(b.start)}–{t(b.end)}
          </span>{" "}
          <span className="text-muted-foreground">
            · {formatDuration(b.end - b.start)} {b.kind ? BREAK_KIND_LABEL[b.kind as keyof typeof BREAK_KIND_LABEL].toLowerCase() : ""} break
          </span>
        </li>
      ))}
    </ul>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full bg-brand" /> Work
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full border border-border bg-card" style={{ backgroundImage: BREAK_HATCH }} /> Break
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-0.5 rounded-full bg-foreground/70" /> Midnight, in the session&apos;s timezone
      </span>
    </div>
  );
}

const RAIL = 300; // px of rail shared by the segments on phones

function Vertical({ split, t, inFix, outFix }: TrackProps) {
  const items = timelineItems(split);
  return (
    <ol className="grid md:hidden" aria-hidden>
      {items.map((item, i) => {
        if (item.kind === "pin") {
          const start = item.pin === "clock_in";
          return (
            <li key={`p${i}`} className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-3">
              <span className={cn("mx-auto size-3.5 rounded-full border-[3px]", item.pin === "now" ? "border-brand bg-card motion-safe:animate-live text-brand" : "border-brand bg-brand")} />
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 py-1">
                <span className="font-display text-base font-semibold tabular">{t(item.at)}</span>
                <span className="text-sm text-muted-foreground">{start ? "Clock in" : item.pin === "now" ? "Now" : "Clock out"}</span>
                <FixNote fix={start ? inFix : outFix} className="basis-full" />
              </div>
            </li>
          );
        }
        if (item.kind === "midnight") {
          return (
            <li key={`m${item.at}`} className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-3">
              <span className="mx-auto h-0.5 w-5 rounded-full bg-foreground/70" />
              <span className="flex items-center gap-2 py-1 text-xs font-medium">
                <span className="rounded-full bg-raised px-2 py-0.5">{formatDate(item.date)}</span>
                <span className="text-muted-foreground">midnight</span>
              </span>
            </li>
          );
        }
        const height = Math.max(item.kind === "break" ? 36 : 28, Math.round(item.frac * RAIL));
        return (
          <li key={`${item.kind}${item.start}`} className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-3" style={{ minHeight: height }}>
            <span
              className={cn("mx-auto w-1.5 self-stretch rounded-full", item.kind === "work" ? "bg-brand" : "border border-border bg-card")}
              style={item.kind === "break" ? { backgroundImage: BREAK_HATCH } : undefined}
            />
            {item.kind === "work" ? (
              <span className="text-xs text-muted-foreground tabular">{formatDuration(item.ms)} work</span>
            ) : (
              <span className="text-xs tabular">
                <span className="font-medium">
                  {t(item.start)}–{t(item.end)}
                </span>{" "}
                <span className="text-muted-foreground">
                  · {formatDuration(item.ms)} {item.breakKind ? BREAK_KIND_LABEL[item.breakKind].toLowerCase() : ""} break
                </span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
