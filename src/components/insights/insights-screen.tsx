"use client";

/**
 * /insights — the range dashboard (or one session's breakdown with `?session=`). Phones: one column in
 * reading order. Desktop: a 12-column grid with the hero ring held in view beside the bars and ribbon.
 */
import * as React from "react";
import Link from "next/link";
import { ChartColumnBigIcon, CheckIcon, ClipboardCheckIcon, TimerIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/status-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { rangeLabel } from "@/lib/insights/labels";
import { insightsHref, type RangeKind } from "@/lib/insights/params";
import { formatDate } from "@/lib/format";
import { useShift, useShiftStore } from "@/lib/store/react";
import { ShiftActionError } from "@/lib/store/store";
import { isLocalDate, startOfWeek } from "@/lib/time/zone";

import { BarsCard } from "./bars-card";
import { RibbonCard } from "./day-ribbon";
import { HeatmapCard } from "./heatmap-card";
import { HoursRing } from "./hours-ring";
import { InsightsControls } from "./insights-controls";
import { MonthCalendar } from "./month-calendar";
import { ClockInCard, DurationsCard } from "./patterns";
import { SessionBreakdownView } from "./session-breakdown";
import { ShareRecap } from "./share-recap";
import { EarningsCard, MonthCompareCard, PlacesCard, RecordsCard } from "./summary-cards";
import { useInsights } from "./use-insights";

const noopSubscribe = () => () => {};

export function InsightsScreen() {
  const s = useInsights();
  const { view, params, range, today, model, facts, navigate } = s;
  const settings = view.profile.settings;
  const hydrated = React.useSyncExternalStore(noopSubscribe, () => true, () => false);

  // `useShift()` can already be ready on the client while hydrating (server rendered the skeleton):
  // keep the skeleton until hydration is over so both renders match.
  if (!hydrated || !view.ready) return <InsightsSkeleton />;

  if (view.loadError) {
    return (
      <div role="alert" className="grid justify-items-start gap-2 rounded-card bg-danger-soft p-5 text-danger-ink">
        <p className="font-medium">Your sessions couldn&apos;t be read from this device.</p>
        <p className="text-sm">{view.loadError} Reload the page; if it keeps happening, export a backup from Settings → Your data.</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    );
  }

  if (params.session) {
    const fact = facts.find((f) => f.session.id === params.session) ?? null;
    return (
      <SessionBreakdownView
        fact={fact}
        inTrash={!fact && view.trash.some((t) => t.id === params.session)}
        clock={settings.clock}
        today={today}
        backHref={insightsHref({ ...params, session: null })}
      />
    );
  }

  if (!model.hasAnyData) {
    return (
      <EmptyState
        icon={<ChartColumnBigIcon />}
        title="Your hours, days and patterns appear here after your first shift."
        action={
          <Button asChild>
            <Link href="/?action=clock-in">
              <TimerIcon aria-hidden />
              Clock in
            </Link>
          </Button>
        }
      />
    );
  }

  const { summary } = model;
  const live = view.active !== null && summary.sessionIds.includes(view.active.id);
  const latest = facts.at(-1);
  const ratedIds = facts.filter((f) => f.session.payRateMinor !== null && summary.sessionIds.includes(f.session.id)).map((f) => f.session.id);
  const showEarnings = model.earnings.show;

  return (
    <div className="grid gap-5 lg:gap-6">
      <InsightsControls
        params={params}
        range={range}
        today={today}
        weekStart={settings.weekStart}
        clock={settings.clock}
        navigate={navigate}
        actions={
          <>
            {params.range === "week" && range.from <= today ? <WeekReview weekOf={range.from} /> : null}
            <ShareRecap model={model} kind={params.range} today={today} defaultGoalMs={settings.defaultGoalSeconds * 1000} />
          </>
        }
      />

      {summary.sessionIds.length === 0 ? (
        <Card variant="raised" padding="sm" className="flex-row flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm">{noShiftsSentence(range, params.range, today)}</p>
          {latest ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate({ ...params, range: params.range === "custom" ? "week" : params.range, date: latest.anchor, from: null, to: null })}
            >
              Go to your latest shift
            </Button>
          ) : null}
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 lg:gap-5">
        <HoursRing model={model} kind={params.range} today={today} live={live} className="md:col-span-12 lg:sticky lg:top-6 lg:col-span-5 lg:row-span-2 lg:self-start" />
        <BarsCard bars={model.bars} today={today} className="md:col-span-12 lg:col-span-7" />
        <RibbonCard ribbon={model.ribbon} clock={settings.clock} today={today} sessionIds={summary.sessionIds} className="md:col-span-12 lg:col-span-7" />
        <RecordsCard records={model.records} daysWorked={summary.daysWorked} today={today} range={range} className="md:col-span-12" />
        <MonthCalendar calendar={model.calendar} facts={facts} mode={model.mode} clock={settings.clock} today={today} className="md:col-span-12 lg:col-span-7" />
        <HeatmapCard heat={model.heat} today={today} onDays={(heat) => navigate({ ...params, heat }, { replace: true })} className="md:col-span-12 lg:col-span-5" />
        <ClockInCard clockIn={model.clockIn} clock={settings.clock} className="md:col-span-6" />
        <DurationsCard durations={model.durations} className="md:col-span-6" />
        <MonthCompareCard comparison={model.comparison} today={today} className={showEarnings ? "md:col-span-6 lg:col-span-4" : "md:col-span-6"} />
        <PlacesCard places={model.places} className={showEarnings ? "md:col-span-6 lg:col-span-4" : "md:col-span-6"} />
        {showEarnings ? <EarningsCard earnings={model.earnings} sessionIds={ratedIds} className="md:col-span-12 lg:col-span-4" /> : null}
      </div>
    </div>
  );
}

function noShiftsSentence(range: { from: string; to: string }, kind: RangeKind, today: string): string {
  if (range.from === range.to) return range.from === today ? "No shifts today yet." : `No shifts on ${formatDate(range.from, { thisYear: today.slice(0, 4) })}.`;
  return `No shifts in ${rangeLabel(range, kind, today)}.`;
}

function WeekReview({ weekOf }: { weekOf: string }) {
  const store = useShiftStore();
  const view = useShift();
  const weekStart = view.profile.settings.weekStart;
  const [busy, setBusy] = React.useState(false);
  const reviewed = view.profile.activities.some((a) => a.type === "week_review" && isLocalDate(a.key) && startOfWeek(a.key, weekStart) === weekOf);
  if (reviewed) {
    return (
      <Pill tone="success" icon={<CheckIcon />} className="h-10 px-3 md:h-9">
        Reviewed
      </Pill>
    );
  }
  return (
    <Button
      variant="soft"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await store.addActivity({ id: `review:${weekOf}`, type: "week_review", key: weekOf });
          toast.success("Week marked as reviewed.");
        } catch (error) {
          toast.error(error instanceof ShiftActionError ? error.error.message : "This week couldn't be marked as reviewed. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <ClipboardCheckIcon aria-hidden />
      <span className="sm:hidden">Review week</span>
      <span className="max-sm:hidden">Mark this week reviewed</span>
    </Button>
  );
}

export function InsightsSkeleton() {
  return (
    <div className="grid gap-5 lg:gap-6" aria-busy="true" aria-label="Loading insights">
      <div className="grid gap-4">
        <Skeleton className="h-10 w-full max-w-[22rem] rounded-control" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-full max-w-[26rem] rounded-control" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 lg:gap-5">
        <Card padding="lg" className="items-center md:col-span-12 lg:col-span-5 lg:row-span-2">
          <Skeleton className="h-5 w-32 self-start" />
          <Skeleton className="size-[280px] rounded-full" />
          <div className="grid w-full grid-cols-3 gap-2">
            <Skeleton className="h-14 rounded-control" />
            <Skeleton className="h-14 rounded-control" />
            <Skeleton className="h-14 rounded-control" />
          </div>
        </Card>
        <Card className="md:col-span-12 lg:col-span-7">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-[196px] w-full" />
        </Card>
        <Card className="md:col-span-12 lg:col-span-7">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-40 w-full" />
        </Card>
        <Card className="md:col-span-12">
          <Skeleton className="h-5 w-24" />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-card" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
