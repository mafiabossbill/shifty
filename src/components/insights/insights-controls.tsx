"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, Layers2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { ClockFormat } from "@/lib/format";
import { MODE_OPTIONS, modeExplanation, rangeLabel } from "@/lib/insights/labels";
import { containsToday, stepParams, withRangeKind, type InsightsParams, type RangeKind } from "@/lib/insights/params";
import type { AllocationMode, DateRange } from "@/lib/reports";
import { isLocalDate, type LocalDate, type WeekStart } from "@/lib/time/zone";

const RANGE_OPTIONS: { value: RangeKind; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom" },
];

const RANGE_NOUN: Record<RangeKind, string> = { today: "day", week: "week", month: "month", year: "year", custom: "range" };

export function InsightsControls({
  params,
  range,
  today,
  weekStart,
  clock,
  navigate,
  actions,
}: {
  params: InsightsParams;
  range: DateRange;
  today: LocalDate;
  weekStart: WeekStart;
  clock: ClockFormat;
  navigate: (next: InsightsParams, opts?: { replace?: boolean }) => void;
  actions?: React.ReactNode;
}) {
  const atNow = containsToday(range, today);
  const atFuture = range.to >= today;
  const noun = RANGE_NOUN[params.range];
  const label = rangeLabel(range, params.range, today);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          ariaLabel="Range"
          value={params.range}
          options={RANGE_OPTIONS}
          onValueChange={(kind) => navigate(withRangeKind(params, kind, range, today))}
          className="max-sm:w-full"
          fullWidth={false}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2 max-sm:w-full max-sm:[&>*]:flex-1">{actions}</div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label={`Previous ${noun}`} onClick={() => navigate(stepParams(params, range, -1, today, weekStart))}>
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={`Next ${noun}`}
            disabled={atFuture}
            onClick={() => navigate(stepParams(params, range, 1, today, weekStart))}
          >
            <ChevronRightIcon />
          </Button>
        </div>
        <p className="type-title tabular min-w-0" aria-live="polite">
          {label}
        </p>
        {!atNow && params.range !== "custom" ? (
          <Button variant="ghost" size="xs" onClick={() => navigate({ ...params, date: null })}>
            Back to {params.range === "today" ? "today" : `this ${noun}`}
          </Button>
        ) : null}
      </div>

      {params.range === "custom" ? <CustomRange params={params} range={range} today={today} navigate={navigate} /> : null}

      <div className="grid gap-1.5">
        <SegmentedControl<AllocationMode>
          ariaLabel="How shifts that cross midnight are counted"
          value={params.mode}
          size="sm"
          onValueChange={(mode) => navigate({ ...params, mode }, { replace: true })}
          className="sm:w-fit"
          fullWidth
          options={MODE_OPTIONS.map((o) => ({
            value: o.value,
            ariaLabel: o.label,
            icon: o.value === "calendar" ? <CalendarDaysIcon aria-hidden /> : <Layers2Icon aria-hidden />,
            label: (
              <>
                <span className="sm:hidden">{o.short}</span>
                <span className="max-sm:hidden">{o.label}</span>
              </>
            ),
          }))}
        />
        <p className="text-xs text-muted-foreground">{modeExplanation(params.mode, clock)}</p>
      </div>
    </div>
  );
}

function CustomRange({
  params,
  range,
  today,
  navigate,
}: {
  params: InsightsParams;
  range: DateRange;
  today: LocalDate;
  navigate: (next: InsightsParams, opts?: { replace?: boolean }) => void;
}) {
  const id = React.useId();
  const set = (key: "from" | "to", value: string) => {
    if (!isLocalDate(value)) return;
    navigate({ ...params, [key]: value, from: key === "from" ? value : range.from, to: key === "to" ? value : range.to }, { replace: true });
  };
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-from`}>From</Label>
        <Input id={`${id}-from`} type="date" value={range.from} max={range.to} onChange={(e) => set("from", e.target.value)} className="w-[11.5rem]" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-to`}>To</Label>
        <Input id={`${id}-to`} type="date" value={range.to} min={range.from} max={today} onChange={(e) => set("to", e.target.value)} className="w-[11.5rem]" />
      </div>
      <p className="pb-2.5 text-xs text-muted-foreground">Up to three years.</p>
    </div>
  );
}
