"use client";

import { CoffeeIcon, MapPinIcon, MoonIcon, PlayIcon, RotateCwIcon, SquareIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Pill, SESSION_STATUS } from "@/components/ui/status-pill";
import { formatDuration, formatInstant, formatStopwatch, spokenDuration, zoneAbbreviation, type ClockFormat } from "@/lib/format";
import { LOCATION_STATUS_COPY } from "@/lib/geo/capture";
import { capturedLocationLine, crossedMidnightLine, goalAtLine, latestFix, splitStopwatch } from "@/lib/home/view-model";
import { sessionStatus, type ShiftSession } from "@/lib/shifts/types";
import { allocateByDay, goalProgress, sessionMetrics } from "@/lib/time/allocate";
import { localDateOf } from "@/lib/time/zone";
import { cn } from "@/lib/utils";

import { HeroGlow } from "./clock-in-hero";

export interface ActiveHeroProps {
  session: ShiftSession;
  now: number;
  clock: ClockFormat;
  ringSize: number;
  busy: boolean;
  locating: boolean;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onClockOut: () => void;
  onRetryLocation: () => void;
}

/** The running session: goal ring with NET WORKED, elapsed vs breaks, start, predicted finish, location, controls. */
export function ActiveHero({ session, now, clock, ringSize, busy, locating, onStartBreak, onEndBreak, onClockOut, onRetryLocation }: ActiveHeroProps) {
  const zone = session.reportingTimeZone;
  const m = sessionMetrics(session, now);
  const status = sessionStatus(session);
  const onBreak = status === "on_break";
  const gp = goalProgress(m.netMs, session.goalSeconds, now, !onBreak);
  const days = allocateByDay(session, now, m);
  const today = localDateOf(now, zone);
  const midnight = crossedMidnightLine(days, today);
  const openBreak = session.breaks.find((b) => b.endedAt === null) ?? null;
  const breakCount = session.breaks.length;
  const [big, seconds] = splitStopwatch(formatStopwatch(m.netMs));
  const goalText = formatDuration(gp.goalMs);
  const overage = gp.goalMs > 0 ? gp.overageMs / gp.goalMs : 0;
  const pill = SESSION_STATUS[status === "completed" ? "completed" : status];

  const ringLabel = `Net worked: ${spokenDuration(m.netMs)} of a ${spokenDuration(gp.goalMs)} goal`;
  const ringValue =
    gp.overageMs > 0 ? `Goal reached, ${spokenDuration(gp.overageMs)} past it` : `${Math.round(gp.ratio * 100)} percent, ${spokenDuration(gp.remainingMs)} to go`;

  return (
    <Card variant="hero" padding="lg" className="items-center gap-5 text-center lg:gap-6">
      <HeroGlow />
      <div className="relative flex w-full flex-wrap items-center justify-between gap-2">
        <Pill tone={pill.tone} live>
          {onBreak ? "On break" : "Working"}
        </Pill>
        <span className="text-xs text-muted-foreground">
          Started {formatInstant(session.startedAt, zone, clock)} {zoneAbbreviation(session.startedAt, zone)}
        </span>
      </div>

      <ProgressRing
        value={gp.ratio}
        overage={overage}
        label={ringLabel}
        valueText={ringValue}
        size={ringSize}
        tone={onBreak ? "celebrate" : "brand"}
        halo
        className="relative"
      >
        <span className="type-eyebrow text-muted-foreground">Net worked</span>
        <span className="mt-1 flex items-baseline justify-center tabular" aria-hidden>
          <span className="type-hero tabular leading-none" style={{ fontSize: `min(17vw, ${Math.round(ringSize * 0.23)}px)` }}>
            {big}
          </span>
          <span className="type-title tabular ml-0.5 text-muted-foreground">{seconds}</span>
        </span>
        <span className="sr-only">{spokenDuration(m.netMs)} net worked</span>
        <span className="mt-2 text-sm text-muted-foreground">
          {gp.overageMs > 0 ? `Goal ${goalText} · +${formatDuration(gp.overageMs)} past it` : `of ${goalText} goal · ${formatDuration(gp.remainingMs)} to go`}
        </span>
      </ProgressRing>

      <dl className="relative grid w-full max-w-md grid-cols-2 gap-2 text-left">
        <Figure label="Total elapsed" value={formatStopwatch(m.elapsedMs)} hint="Breaks included" />
        <Figure
          label="Breaks"
          value={formatStopwatch(m.breakMs)}
          hint={breakCount === 0 ? "None yet" : `${breakCount} ${breakCount === 1 ? "break" : "breaks"} · not in net`}
          highlight={onBreak}
        />
      </dl>

      <div className="relative grid w-full gap-1.5 text-sm text-muted-foreground">
        {onBreak && openBreak ? (
          <p className="font-medium text-celebrate-ink">
            On break · <span className="tabular">{formatStopwatch(now - openBreak.startedAt)}</span>
          </p>
        ) : gp.predictedFinishAt !== null ? (
          <p className="text-foreground">{goalAtLine(gp.predictedFinishAt, now, zone, clock)}</p>
        ) : null}
        {midnight ? (
          <p className="text-xs text-balance">
            {midnight.split(/(?<=·|,) /).map((part, i) => (
              <span key={i} className="whitespace-nowrap">
                {i > 0 ? " " : <MoonIcon className="mr-1 -mt-0.5 inline size-3.5" aria-hidden />}
                {part}
              </span>
            ))}
          </p>
        ) : null}
        <LocationLine session={session} zone={zone} now={now} locating={locating} onRetry={onRetryLocation} />
      </div>

      <div className="relative grid w-full max-w-md gap-3 sm:grid-cols-2">
        {onBreak ? (
          <Button size="lg" variant="soft" disabled={busy} onClick={onEndBreak} className="h-14 w-full md:h-14">
            <PlayIcon className="fill-current" aria-hidden /> End break
          </Button>
        ) : (
          <Button size="lg" variant="secondary" disabled={busy} onClick={onStartBreak} className="h-14 w-full md:h-14">
            <CoffeeIcon aria-hidden /> Start break
          </Button>
        )}
        <Button
          size="lg"
          variant="ghost"
          disabled={busy}
          onClick={onClockOut}
          className="h-14 w-full border border-danger/25 bg-danger-soft text-danger-ink hover:bg-danger-soft/70 active:bg-danger-soft/60 md:h-14"
        >
          <SquareIcon className="size-3.5 fill-current" aria-hidden /> Clock out
        </Button>
      </div>
    </Card>
  );
}

function Figure({ label, value, hint, highlight }: { label: string; value: string; hint: string; highlight?: boolean }) {
  return (
    <div className={cn("grid gap-1 rounded-control bg-raised px-4 py-3", highlight && "ring-1 ring-celebrate/40")}>
      <dt className="type-eyebrow text-muted-foreground">{label}</dt>
      <dd className="font-display text-2xl font-semibold tabular lg:text-[1.75rem]">{value}</dd>
      <dd className="text-xs text-muted-foreground">{hint}</dd>
    </div>
  );
}

function LocationLine({ session, zone, now, locating, onRetry }: { session: ShiftSession; zone: string; now: number; locating: boolean; onRetry: () => void }) {
  const fix = latestFix(session);
  if (!fix && !locating && now - session.startedAt > 90_000) {
    return (
      <div className="grid justify-items-center gap-2 text-xs">
        <p>
          <MapPinIcon className="mr-1 -mt-0.5 inline size-3.5" aria-hidden />
          No location recorded for this session.
        </p>
        <Button variant="soft" size="xs" onClick={onRetry} className="h-8">
          <RotateCwIcon aria-hidden /> Try again
        </Button>
      </div>
    );
  }
  if (locating || !fix) {
    return (
      <p className="inline-flex items-center justify-center gap-1.5 text-xs">
        <MapPinIcon className="size-3.5" aria-hidden /> Getting your location…
      </p>
    );
  }
  if (fix.status === "captured") {
    return (
      <p className="inline-flex items-center justify-center gap-1.5 text-xs">
        <MapPinIcon className="size-3.5 text-success" aria-hidden />
        <span className="tabular">{capturedLocationLine(fix, zone)}</span>
      </p>
    );
  }
  const canRetry = fix.status !== "off" && fix.status !== "unsupported" && fix.status !== "insecure";
  return (
    <div className="grid justify-items-center gap-2 text-xs">
      <p className="text-balance">
        <MapPinIcon className="mr-1 -mt-0.5 inline size-3.5" aria-hidden />
        {LOCATION_STATUS_COPY[fix.status]}
      </p>
      {canRetry ? (
        <Button variant="soft" size="xs" onClick={onRetry} className="h-8">
          <RotateCwIcon aria-hidden /> Try again
        </Button>
      ) : null}
    </div>
  );
}
