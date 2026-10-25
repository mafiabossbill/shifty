"use client";

/** `?session=<id>`: one session's allocation — its ribbon and what it adds to each calendar date. */
import * as React from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, SearchXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { formatDate, formatDuration, spokenDuration, type ClockFormat } from "@/lib/format";
import { durationsByRow, plural, sessionHref } from "@/lib/insights/labels";
import { buildSessionBreakdown } from "@/lib/insights/model";
import type { SessionFacts } from "@/lib/reports";
import type { LocalDate } from "@/lib/time/zone";

import { DataTable, DrillLink, LegendItem } from "./chart-kit";
import { RibbonChart, rowTitle, spanText } from "./day-ribbon";

export function SessionBreakdownView({
  fact,
  inTrash,
  clock,
  today,
  backHref,
}: {
  fact: SessionFacts | null;
  inTrash: boolean;
  clock: ClockFormat;
  today: LocalDate;
  backHref: string;
}) {
  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
      <Link href={backHref}>
        <ArrowLeftIcon aria-hidden />
        All insights
      </Link>
    </Button>
  );
  if (!fact) {
    return (
      <div className="grid gap-4">
        {back}
        <EmptyState
          icon={<SearchXIcon />}
          title={inTrash ? "This session is in the trash, so it isn't counted." : "This session isn't on this device."}
          action={
            <Button asChild variant="secondary">
              <Link href={inTrash ? "/sessions/trash" : "/sessions"}>{inTrash ? "Open trash" : "All sessions"}</Link>
            </Button>
          }
        />
      </div>
    );
  }
  const b = buildSessionBreakdown(fact);
  const y = today.slice(0, 4);
  const ribbon = { rows: [b.row], hidden: 0, axis: b.axis };
  const netText = durationsByRow(b.row.days, (d) => d.date, (d) => d.netMs);
  const breakText = durationsByRow(b.row.days, (d) => d.date, (d) => d.breakMs);
  const clockedText = durationsByRow(b.row.days, (d) => d.date, (d) => d.elapsedMs);
  return (
    <div className="grid gap-4 lg:gap-5">
      {back}
      <Card padding="lg" role="region" aria-labelledby="session-breakdown-title">
        <CardHeader
          action={
            <Button asChild variant="soft" size="sm">
              <Link href={sessionHref(b.row.sessionId)}>
                Open session
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          }
        >
          <CardTitle id="session-breakdown-title" className="type-title">
            {rowTitle(b.row, clock)}
          </CardTitle>
          <CardDescription className="tabular">{spanText(b.row, clock, today)}</CardDescription>
        </CardHeader>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatTile variant="raised" label="Net worked" value={formatDuration(b.row.netMs)} hint={b.row.running ? "Still running" : undefined} />
          <StatTile variant="raised" label="Breaks" value={formatDuration(b.row.breakMs)} />
          <StatTile variant="raised" label="Clocked time" value={formatDuration(b.row.netMs + b.row.breakMs)} />
          <StatTile variant="raised" label="Calendar days" value={String(b.row.days.length)} hint={b.row.days.length > 1 ? "Crosses midnight" : "Within one day"} />
        </div>
        <RibbonChart
          ribbon={ribbon}
          clock={clock}
          today={today}
          rowHeight={28}
          showDayLabels
          label={`This session as one band: ${plural(b.row.days.length, "calendar day")}, ${spokenDuration(b.row.netMs)} net`}
        />
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <LegendItem kind="net" label="Start date" />
          <LegendItem kind="next" label="Next date" />
        </div>
      </Card>
      <Card role="region" aria-labelledby="session-days-title">
        <CardHeader>
          <CardTitle id="session-days-title">What it adds to each day</CardTitle>
          <CardDescription className="text-xs">
            Allocated to calendar days in {b.row.zone}. Grouped by start date, all of it counts on {formatDate(b.startedOn, { thisYear: y })}.
          </CardDescription>
        </CardHeader>
        <div className="overflow-auto rounded-control border border-border">
          <DataTable
            caption="This session's time per calendar date"
            rows={b.row.days}
            rowKey={(d) => d.date}
            columns={[
              { label: "Date", cell: (d) => <DrillLink href={`/sessions?date=${d.date}`}>{formatDate(d.date, { thisYear: y })}</DrillLink> },
              { label: "Net", numeric: true, cell: (d) => netText.get(d.date) },
              { label: "Breaks", numeric: true, cell: (d) => breakText.get(d.date) },
              { label: "Clocked", numeric: true, cell: (d) => clockedText.get(d.date) },
            ]}
            foot={["Total", formatDuration(b.totalNetMs), formatDuration(b.row.breakMs), formatDuration(b.row.netMs + b.row.breakMs)]}
          />
        </div>
      </Card>
    </div>
  );
}
