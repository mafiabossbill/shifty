"use client";

/** H. Records · I. Month on month · J. Places · K. Earnings. Every number links to its sessions. */
import * as React from "react";
import Link from "next/link";
import { MapPinIcon, MapPinOffIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { formatDate, formatDuration, formatMonth } from "@/lib/format";
import { deltaSentence, plural, sessionHref, sessionsHref, spanLabel } from "@/lib/insights/labels";
import type { ComparisonModel, InsightsModel, RecordsModel } from "@/lib/insights/model";
import { formatMinor } from "@/lib/money";
import type { DateRange } from "@/lib/reports";
import type { LocalDate } from "@/lib/time/zone";
import { cn } from "@/lib/utils";

import { ChartCard, DataTable, DrillLink } from "./chart-kit";

export function RecordsCard({ records, daysWorked, today, range, className }: { records: RecordsModel; daysWorked: number; today: LocalDate; range: DateRange; className?: string }) {
  const y = today.slice(0, 4);
  const elapsed = records.netMs + records.breakMs;
  const tile = (props: React.ComponentProps<typeof StatTile>) => <StatTile variant="raised" {...props} />;
  return (
    <Card className={cn("min-w-0", className)} role="region" aria-labelledby="insights-records">
      <CardHeader>
        <CardTitle id="insights-records">Records</CardTitle>
        <CardDescription className="text-xs">For this range. Tap a number to see the shifts behind it.</CardDescription>
      </CardHeader>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:gap-3">
        {tile({ label: "Sessions", value: String(records.sessions.length), href: sessionsHref(records.sessions, range) ?? undefined, hint: plural(daysWorked, "day") + " worked" })}
        {tile({ label: "Net worked", value: formatDuration(records.netMs), href: sessionsHref(records.sessions, range) ?? undefined })}
        {tile({
          label: "Breaks",
          value: formatDuration(records.breakMs),
          hint: elapsed > 0 ? `${Math.round((records.breakMs / elapsed) * 100)}% of clocked time` : undefined,
          href: sessionsHref(records.sessions, range) ?? undefined,
        })}
        {tile({
          label: "Longest session",
          value: records.longest ? formatDuration(records.longest.netMs) : "—",
          hint: records.longest ? `Started ${formatDate(records.longest.anchor, { thisYear: y })}` : "No finished shifts",
          href: records.longest ? sessionHref(records.longest.sessionId) : undefined,
        })}
        {tile({
          label: "Most in one day",
          value: records.bestDay ? formatDuration(records.bestDay.netMs) : "—",
          hint: records.bestDay ? formatDate(records.bestDay.date, { thisYear: y }) : undefined,
          href: records.bestDay ? (sessionsHref(records.bestDay.sessionIds) ?? undefined) : undefined,
        })}
        {tile({
          label: "Goal reached",
          value: records.goal.completed ? `${records.goal.reached} of ${records.goal.completed}` : "—",
          hint: records.goal.ratio !== null ? `${Math.round(records.goal.ratio * 100)}% of finished shifts` : undefined,
          href: sessionsHref(records.goal.reachedIds) ?? undefined,
        })}
        {tile({
          label: "Crossed midnight",
          value: String(records.crossMidnight.length),
          hint: records.crossMidnight.length ? "Split across calendar days" : undefined,
          href: sessionsHref(records.crossMidnight) ?? undefined,
        })}
        {tile({ label: "Days worked", value: String(daysWorked), hint: daysWorked ? `${formatDuration(records.netMs / daysWorked)} per day worked` : undefined })}
      </div>
    </Card>
  );
}

export function MonthCompareCard({ comparison, today, className }: { comparison: ComparisonModel; today: LocalDate; className?: string }) {
  const y = today.slice(0, 4);
  const { current, previous } = comparison;
  const max = Math.max(current.netMs, previous.netMs, 1);
  const rows = [
    { key: "current", title: `${formatMonth(current.from.slice(0, 7)).split(" ")[0]} so far`, span: spanLabel(current.from, current.to, y), ...current, tone: "bg-brand" },
    { key: "previous", title: formatMonth(previous.from.slice(0, 7)).split(" ")[0], span: spanLabel(previous.from, previous.to, y), ...previous, tone: "bg-muted-foreground/45" },
  ];
  const nothing = current.netMs === 0 && previous.netMs === 0;
  return (
    <ChartCard
      title="Month on month"
      description="This month so far against the same days last month"
      className={className}
      empty={nothing ? "No time this month or the same days last month." : null}
      headline={<p className="text-base font-medium text-balance">{deltaSentence(comparison.deltaMs, "the same days last month")}.</p>}
      table={
        <DataTable
          caption="This month so far against the same days last month"
          rows={rows}
          rowKey={(r) => r.key}
          columns={[
            { label: "Period", cell: (r) => `${r.title} (${r.span})` },
            { label: "Net", numeric: true, cell: (r) => <DrillLink href={sessionsHref(r.sessionIds)}>{formatDuration(r.netMs)}</DrillLink> },
          ]}
        />
      }
    >
      <ul className="grid gap-3">
        {rows.map((r) => {
          const href = sessionsHref(r.sessionIds);
          const body = (
            <>
              <span className="flex items-baseline gap-2 text-xs">
                <span className="font-medium">{r.title}</span>
                <span className="text-muted-foreground">{r.span}</span>
                <span className="ml-auto font-display text-base font-semibold tabular">{formatDuration(r.netMs)}</span>
              </span>
              <span className="block h-2.5 overflow-hidden rounded-full bg-track">
                <span className={cn("block h-full rounded-full", r.tone)} style={{ width: `${(r.netMs / max) * 100}%` }} />
              </span>
            </>
          );
          return (
            <li key={r.key}>
              {href ? (
                <Link href={href} className="grid gap-1.5 rounded-control p-1 -m-1 focus-ring hover:bg-accent/60">
                  {body}
                </Link>
              ) : (
                <div className="grid gap-1.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}

export function PlacesCard({ places, className }: { places: InsightsModel["places"]; className?: string }) {
  const nothing = places.rows.length === 0;
  return (
    <ChartCard
      title="Places"
      description="Where shifts in this range started. No maps or coordinates."
      className={className}
      empty={nothing ? "No shifts in this range yet." : null}
      table={
        <DataTable
          caption="Net time by clock-in place"
          rows={places.rows}
          rowKey={(p) => `${p.kind}:${p.label}`}
          columns={[
            { label: "Place", cell: (p) => p.label },
            { label: "Net", numeric: true, cell: (p) => <DrillLink href={sessionsHref(p.sessionIds)}>{formatDuration(p.netMs)}</DrillLink> },
            { label: "Share", numeric: true, cell: (p) => `${Math.round(p.share * 100)}%` },
          ]}
        />
      }
    >
      {!places.anyCaptured ? (
        <EmptyState
          variant="inline"
          className="py-6"
          icon={<MapPinOffIcon />}
          title="Location wasn't captured for these shifts."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/settings/privacy">Location settings</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-1">
          {places.rows.map((p) => {
            const href = sessionsHref(p.sessionIds);
            return (
              <li key={`${p.kind}:${p.label}`}>
                <Link href={href ?? "/sessions"} className="grid gap-1.5 rounded-control px-2 py-2 -mx-2 focus-ring hover:bg-accent/60">
                  <span className="flex items-center gap-2 text-sm">
                    {p.kind === "place" ? <MapPinIcon className="size-3.5 text-brand" aria-hidden /> : <MapPinOffIcon className="size-3.5 text-muted-foreground" aria-hidden />}
                    <span className={cn("truncate", p.kind !== "place" && "text-muted-foreground")}>{p.label}</span>
                    <span className="ml-auto font-medium tabular">{formatDuration(p.netMs)}</span>
                    <span className="w-9 text-right text-2xs text-muted-foreground tabular">{Math.round(p.share * 100)}%</span>
                  </span>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-track">
                    <span className={cn("block h-full rounded-full", p.kind === "place" ? "bg-brand" : "bg-muted-foreground/40")} style={{ width: `${p.share * 100}%` }} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ChartCard>
  );
}

export function EarningsCard({ earnings, sessionIds, className }: { earnings: InsightsModel["earnings"]; sessionIds: string[]; className?: string }) {
  return (
    <ChartCard
      title="Earnings"
      description="Estimate — no overtime rules applied"
      className={className}
      empty={earnings.rows.length === 0 ? "No paid time in this range." : null}
      emptyAction={
        <Button asChild variant="secondary" size="sm">
          <Link href="/settings">Pay settings</Link>
        </Button>
      }
    >
      <ul className="grid gap-3">
        {earnings.rows.map((e) => (
          <li key={e.currency} className="grid gap-0.5">
            <Link href={sessionsHref(sessionIds) ?? "/sessions"} className="w-fit rounded-sm focus-ring">
              <span className="type-stat">{formatMinor(e.amountMinor, e.currency)}</span>
            </Link>
            <span className="text-xs text-muted-foreground">
              {formatDuration(e.netMs)} of paid time · {e.currency}
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
