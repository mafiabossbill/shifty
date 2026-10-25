"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { buildInsights, type InsightsModel } from "@/lib/insights/model";
import { insightsHref, parseParams, resolveRange, type InsightsParams } from "@/lib/insights/params";
import { sessionFacts, type DateRange, type SessionFacts } from "@/lib/reports";
import { useNow, useShift } from "@/lib/store/react";
import type { StoreView } from "@/lib/store/store";
import { localDateOf, type LocalDate } from "@/lib/time/zone";

export interface InsightsState {
  view: StoreView;
  now: number;
  today: LocalDate;
  params: InsightsParams;
  range: DateRange;
  facts: SessionFacts[];
  model: InsightsModel;
  navigate: (next: InsightsParams, opts?: { replace?: boolean }) => void;
}

/**
 * Everything the Insights screen needs. Finished sessions are turned into facts once per change of the
 * session list; only the running session is recomputed, from timestamps, every minute (`useNow(60000)`).
 */
export function useInsights(): InsightsState {
  const view = useShift();
  const now = useNow(60_000);
  const search = useSearchParams();
  const router = useRouter();
  const params = React.useMemo(() => parseParams(search), [search]);
  const settings = view.profile.settings;
  const today = localDateOf(now, settings.reportingTimeZone);
  const range = resolveRange(params, today, settings.weekStart);

  const finished = React.useMemo(() => sessionFacts(view.sessions.filter((s) => s.endedAt !== null), 0), [view.sessions]);
  const running = view.sessions.filter((s) => s.endedAt === null);
  const runningKey = running.map((s) => `${s.id}:${s.revision}`).join(",");
  const facts = React.useMemo(() => {
    if (!runningKey) return finished;
    return [...finished, ...sessionFacts(running, now)].sort((a, b) => a.session.startedAt - b.session.startedAt);
    // `running` is derived from view.sessions; its identity changes each render, its key doesn't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, runningKey, now]);

  const model = React.useMemo(
    () =>
      buildInsights({
        facts,
        range,
        kind: params.range,
        mode: params.mode,
        today,
        weekStart: settings.weekStart,
        heatDays: params.heat,
        defaultGoalMs: settings.defaultGoalSeconds * 1000,
        payTracking: settings.payTracking,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facts, range.from, range.to, params.range, params.mode, params.heat, today, settings.weekStart, settings.defaultGoalSeconds, settings.payTracking],
  );

  const navigate = React.useCallback(
    (next: InsightsParams, opts: { replace?: boolean } = {}) => {
      const href = insightsHref(next);
      if (opts.replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [router],
  );

  return { view, now, today, params, range, facts, model, navigate };
}
