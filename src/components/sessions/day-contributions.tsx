import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { formatDate, formatDuration, spokenDuration } from "@/lib/format";
import type { DaySplit } from "@/lib/sessions/geometry";
import { apportionMinutes } from "@/lib/sessions/wording";
import { cn } from "@/lib/utils";

/**
 * A row per calendar date the session touches (net + break), each linking to that day's sessions, and the
 * sum underneath: the rows always add up to the session's net exactly (integer ms in the engine).
 */
export function DayContributions({ split, netMs, thisYear }: { split: DaySplit; netMs: number; thisYear: string }) {
  const most = Math.max(1, ...split.days.map((d) => d.netMs + d.breakMs));
  // Shown minutes add up to the shown total, even when each day has stray seconds.
  const minutes = apportionMinutes(split.days.map((d) => d.netMs));
  return (
    <div className="grid">
      <ul className="divide-y divide-border">
        {split.days.map((d, i) => (
          <li key={d.date}>
            <Link
              href={`/sessions?date=${d.date}`}
              prefetch={false}
              aria-label={`${formatDate(d.date, { long: true, thisYear })}: ${spokenDuration(d.netMs)} net${d.breakMs ? `, ${spokenDuration(d.breakMs)} break` : ""}. Show every session on this date.`}
              className="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1.5 rounded-control py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn("size-2 shrink-0 rounded-full", i % 2 === 0 ? "bg-brand" : "bg-brand/55")} aria-hidden />
                <span className="truncate font-medium group-hover:underline">{formatDate(d.date, { thisYear })}</span>
              </span>
              <span className="text-right text-xs text-muted-foreground tabular">{d.breakMs ? `${formatDuration(d.breakMs)} break` : ""}</span>
              <span className="flex items-center gap-1 text-right font-display font-semibold tabular">
                {formatDuration(minutes[i] * 60_000)}
                <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
              </span>
              <span className="col-span-3 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden>
                <span className={cn("block h-full rounded-full", i % 2 === 0 ? "bg-brand" : "bg-brand/55")} style={{ width: `${(d.netMs / most) * 100}%` }} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-3 border-t-2 border-border-strong pt-3">
        <span className="text-sm text-muted-foreground">
          {split.days.length === 1 ? "All on one day" : `${split.days.length} days`}
        </span>
        <span className="font-display text-lg font-semibold tabular">= {formatDuration(netMs)}</span>
      </div>
    </div>
  );
}
