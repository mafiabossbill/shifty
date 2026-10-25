"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRightIcon, LeafIcon, SnowflakeIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/status-pill";
import { formatDuration, formatInstant, smartTitle, spokenDuration, type ClockFormat } from "@/lib/format";
import { daySplitLine, latestFix, rhythmLines, weekBars } from "@/lib/home/view-model";
import { dailyTotals, rangeFor, sessionFacts, summarize } from "@/lib/reports";
import type { RewardsResult } from "@/lib/rewards/types";
import type { Nudge } from "@/lib/shifts/nudges";
import type { Project } from "@/lib/shifts/profile";
import type { ShiftSession } from "@/lib/shifts/types";
import { allocateByDay, sessionMetrics } from "@/lib/time/allocate";
import { localDateOf, wallClock, type WeekStart } from "@/lib/time/zone";
import { cn } from "@/lib/utils";

/** Net this week (calendar mode: midnight-crossing time lands on the day it was worked) + a 7-bar sparkline. `now` is the live clock. */
export function WeekCard({ sessions, now, zone, weekStart }: { sessions: readonly ShiftSession[]; now: number; zone: string; weekStart: WeekStart }) {
  const today = localDateOf(now, zone);
  // Finished sessions don't depend on the clock (`now` unused for them): computed once per data change. The running one is recomputed with
  // the exact `now`, so this total reads the same minute as the hero's readout (no coarse tick lagging behind it).
  const closedFacts = useMemo(() => sessionFacts(sessions.filter((s) => s.endedAt !== null), 0), [sessions]);
  const running = sessions.filter((s) => s.endedAt === null);
  const week = summarize(dailyTotals([...closedFacts, ...sessionFacts(running, now)], "calendar"), rangeFor("week", today, weekStart), "calendar");
  const bars = weekBars(week.series, today);

  return (
    <Card>
      <CardHeader
        action={
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href="/insights">
              Insights <ChevronRightIcon aria-hidden />
            </Link>
          </Button>
        }
      >
        <CardTitle>This week</CardTitle>
        <CardDescription>
          {week.daysWorked} {week.daysWorked === 1 ? "day" : "days"} worked · net, split at midnight
        </CardDescription>
      </CardHeader>
      <div className="flex items-end justify-between gap-4">
        <div className="grid gap-0.5">
          <span className="type-stat tabular">{formatDuration(week.netMs)}</span>
          <span className="text-xs text-muted-foreground">Breaks {formatDuration(week.breakMs)}</span>
        </div>
        <div className="flex h-20 items-end gap-1.5" aria-hidden>
          {bars.map((b) => (
            <div key={b.date} className="flex h-full w-5 flex-col items-center justify-end gap-1.5 sm:w-6">
              <div className="flex w-full flex-1 items-end">
                <div
                  className={cn(
                    "w-full rounded-[5px] motion-safe:transition-[height] motion-safe:duration-500",
                    b.netMs === 0 ? "h-1 bg-track" : b.isToday ? "bg-brand dark:shadow-[0_0_10px_var(--glow)]" : "bg-brand/35",
                  )}
                  style={b.netMs > 0 ? { height: `${Math.max(8, Math.round(b.ratio * 100))}%` } : undefined}
                />
              </div>
              <span className={cn("text-2xs leading-none", b.isToday ? "font-semibold text-brand" : "text-muted-foreground")}>{b.letter}</span>
            </div>
          ))}
        </div>
      </div>
      <ul className="sr-only">
        {bars.map((b) => (
          <li key={b.date}>
            {b.weekday}
            {b.isToday ? " (today)" : ""}: {spokenDuration(b.netMs)}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Forgiving streak: current rhythm, today's state, freezes. Level as a quiet line. */
export function RhythmCard({ rewards }: { rewards: RewardsResult }) {
  const r = rewards.rhythm;
  const lines = rhythmLines(r);
  return (
    <Card>
      <CardHeader
        action={
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href="/companion">
              Level {rewards.level} <ChevronRightIcon aria-hidden />
            </Link>
          </Button>
        }
      >
        <CardTitle>Your rhythm</CardTitle>
        <CardDescription>Planned days you logged, with rest days in between.</CardDescription>
      </CardHeader>
      <div className="flex items-center gap-4">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-ink" aria-hidden>
          <LeafIcon className="size-5" />
        </span>
        <div className="grid min-w-0 gap-0.5">
          <p className="font-display text-lg font-semibold">{lines.headline}</p>
          <p className="text-sm text-muted-foreground">{lines.today}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Pill tone="info" icon={<SnowflakeIcon />}>
          {r.freezesAvailable} {r.freezesAvailable === 1 ? "freeze" : "freezes"}
        </Pill>
        {r.best > 0 ? <span>Best {r.best} {r.best === 1 ? "day" : "days"}</span> : null}
      </div>
      <p className="text-xs text-muted-foreground">{lines.freezes}</p>
    </Card>
  );
}

export function LastSessionCard({ session, now, clock, projects }: { session: ShiftSession; now: number; clock: ClockFormat; projects: readonly Project[] }) {
  const zone = session.reportingTimeZone;
  const m = sessionMetrics(session, now);
  const days = allocateByDay(session, now, m);
  const project = session.projectId ? projects.find((p) => p.id === session.projectId) : undefined;
  return (
    <Card padding="none" className="gap-0">
      <Link href={`/sessions/view?id=${session.id}`} className="grid gap-3 rounded-card p-5 transition-colors hover:bg-accent/40 focus-ring lg:p-6">
        <div className="flex items-center gap-3">
          <div className="grid min-w-0 flex-1 gap-0.5">
            <span className="type-eyebrow text-muted-foreground">Last session</span>
            <span className="truncate font-display text-base font-semibold">{session.title || smartTitle(wallClock(session.startedAt, zone).hour, latestFix(session)?.placeLabel)}</span>
          </div>
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="type-stat tabular">{formatDuration(m.netMs)}</span>
          <span className="text-right text-xs text-muted-foreground">
            {formatInstant(session.startedAt, zone, clock)}
            {project ? ` · ${project.name}` : ""}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Breaks {formatDuration(m.breakMs)}
          {days.length > 1 ? ` · ${daySplitLine(days)}` : ""}
        </p>
      </Link>
    </Card>
  );
}

export function NudgeCard({ nudge, onDismiss }: { nudge: Nudge; onDismiss: () => void }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-card border border-border bg-card px-4 py-3.5 shadow-card">
      <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-ink" aria-hidden>
        <LeafIcon className="size-4" />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="font-medium">{nudge.title}</p>
        <p className="text-sm text-muted-foreground">{nudge.body}</p>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onDismiss} aria-label={`Dismiss: ${nudge.title}`} className="-mr-1">
        <XIcon aria-hidden />
      </Button>
    </div>
  );
}
