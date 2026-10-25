"use client";

import { HistoryIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Page, PageHeader } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDuration } from "@/lib/format";
import { DEFAULT_QUERY, filterOptions, filterRows, groupRows, sortRows, type RowGroup } from "@/lib/sessions/query";
import { buildRows } from "@/lib/sessions/rows";
import { useNow, useShift } from "@/lib/store/react";
import { deviceTimeZone, localDateOf } from "@/lib/time/zone";

import { Chip, FilterChips, ListToolbar } from "./list-toolbar";
import { SessionRowItem } from "./session-row";
import { useSessionQuery } from "./use-session-query";

const PAGE = 60;

export function SessionsScreen() {
  const view = useShift();
  const { query, setQuery } = useSessionQuery();
  // Completed rows are cached by identity; `now` only moves the running session (and Today/Yesterday).
  const now = useNow(view.active ? 15_000 : 300_000);
  const { settings, projects } = view.profile;
  const deviceZone = useMemo(() => deviceTimeZone(), []);
  const [limit, setLimit] = useState({ key: "", n: PAGE });

  const rows = useMemo(() => buildRows(view.sessions, now, projects), [view.sessions, now, projects]);
  const choices = useMemo(() => ({ projects: projects.filter((p) => !p.archived || p.id === query.project), ...filterOptions(rows) }), [projects, rows, query.project]);
  const shown = useMemo(() => sortRows(filterRows(rows, query), query.sort), [rows, query]);
  const queryKey = JSON.stringify(query);
  const n = limit.key === queryKey ? limit.n : PAGE;
  const today = localDateOf(now, settings.reportingTimeZone);
  const groups = useMemo(() => groupRows(shown.slice(0, n), query.sort, today), [shown, n, query.sort, today]);

  const trashCount = view.trash.length;
  const actions = (
    <>
      <Button asChild variant="ghost" size="sm">
        <Link href="/sessions/trash">
          <Trash2Icon />
          Trash{trashCount ? ` (${trashCount})` : ""}
        </Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/sessions/new">
          <PlusIcon />
          Add missed session
        </Link>
      </Button>
    </>
  );

  if (!view.ready) return <ListSkeleton />;

  if (view.loadError) {
    return (
      <Page>
        <PageHeader title="Sessions" />
        <EmptyState title="Your sessions couldn't be opened on this device." description={`${view.loadError} Reload the page; if it keeps happening, check that this browser allows site storage.`} />
      </Page>
    );
  }

  if (view.sessions.length === 0) {
    return (
      <Page>
        <PageHeader title="Sessions" actions={trashCount ? actions : undefined} />
        <EmptyState
          icon={<HistoryIcon />}
          title="Every shift you finish is listed here, newest first."
          action={
            <Button asChild variant="secondary">
              <Link href="/sessions/new">
                <PlusIcon />
                Add a missed session
              </Link>
            </Button>
          }
        />
      </Page>
    );
  }

  const totalNet = shown.reduce((s, r) => s + (query.date ? (r.days.find((d) => d.date === query.date)?.netMs ?? 0) : r.metrics.netMs), 0);
  const drill = query.ids ? `Showing ${shown.length} session${shown.length === 1 ? "" : "s"} from Insights` : query.date ? `Time on ${formatDate(query.date, { thisYear: today.slice(0, 4) })}` : null;

  return (
    <Page>
      <PageHeader title="Sessions" actions={actions} />
      <div className="grid gap-4">
        <ListToolbar query={query} setQuery={setQuery} choices={choices} />
        <div className="flex flex-wrap items-center gap-2">
          {drill ? <Chip tone="accent" label={drill} clearLabel="Clear" onClear={() => setQuery((q) => ({ ...q, ids: null, date: null }))} /> : null}
          <FilterChips query={query} setQuery={setQuery} choices={choices} />
          <p className="ml-auto text-xs text-muted-foreground tabular" aria-live="polite">
            {shown.length} session{shown.length === 1 ? "" : "s"} · {formatDuration(totalNet)} net
          </p>
        </div>

        {shown.length === 0 ? (
          <EmptyState
            title={query.q ? `No sessions match “${query.q}”.` : "No sessions match these filters."}
            action={
              <Button variant="secondary" onClick={() => setQuery({ ...DEFAULT_QUERY, sort: query.sort })}>
                Clear search and filters
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4">
            <Card padding="none" className="gap-0 overflow-hidden">
              <div
                className="hidden grid-cols-[minmax(0,1fr)_10.5rem_minmax(7rem,13rem)_5.5rem_5.5rem] gap-x-4 border-b border-border px-5 py-2.5 type-eyebrow text-muted-foreground md:grid"
                aria-hidden
              >
                <span>Session</span>
                <span>Time</span>
                <span>Day split</span>
                <span className="text-right">Breaks</span>
                <span className="text-right">{query.date ? "That day" : "Net"}</span>
              </div>
              {groups.map((g) => (
                <Group key={g.key} group={g} now={now} clock={settings.clock} deviceZone={deviceZone} view={view} date={query.date} />
              ))}
            </Card>
            {shown.length > n ? (
              <div className="flex flex-col items-center gap-1">
                <Button variant="secondary" onClick={() => setLimit({ key: queryKey, n: n + PAGE })}>
                  Show {Math.min(PAGE, shown.length - n)} more
                </Button>
                <span className="text-xs text-muted-foreground tabular">
                  {n} of {shown.length} shown
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Page>
  );
}

/** A date divider row (Today, Yesterday, Mon 26 Oct) and that day's sessions, inside the one list card. */
function Group({
  group,
  now,
  clock,
  deviceZone,
  view,
  date,
}: {
  group: RowGroup;
  now: number;
  clock: "24h" | "12h";
  deviceZone: string;
  view: ReturnType<typeof useShift>;
  date: string | null;
}) {
  const headingId = `g-${group.key}`;
  return (
    <section aria-labelledby={group.label ? headingId : undefined} className="border-b border-border last:border-b-0">
      {group.label ? (
        <div className="flex items-baseline justify-between gap-3 border-b border-border bg-raised/45 px-4 py-2 md:px-5">
          <h2 id={headingId} className="font-display text-sm font-semibold tracking-tight">
            {group.label}
          </h2>
          {!date ? (
            <span className="text-xs text-muted-foreground tabular">
              {group.rows.length > 1 ? `${group.rows.length} sessions · ` : ""}
              {formatDuration(group.netMs)}
            </span>
          ) : null}
        </div>
      ) : null}
      <ul className="divide-y divide-border">
        {group.rows.map((row) => (
          <li key={row.session.id}>
            <SessionRowItem
              row={row}
              now={now}
              clock={clock}
              deviceZone={deviceZone}
              sync={view.sessionSync[row.session.id]}
              mode={view.sync.mode}
              showDate={!group.label}
              contribution={date ? (row.days.find((d) => d.date === date) ?? null) : null}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ListSkeleton() {
  return (
    <Page>
      <div className="grid gap-4" aria-busy="true" aria-label="Loading sessions">
        <div className="flex items-end justify-between gap-3 lg:mb-4">
          <Skeleton className="hidden h-9 w-48 lg:block" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-44" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 flex-1" />
          <Skeleton className="h-11 w-28" />
        </div>
        {[3, 2].map((count, g) => (
          <div key={g} className="grid gap-2">
            <Skeleton className="h-5 w-28" />
            <div className="grid gap-px overflow-hidden rounded-card border border-border bg-card">
              {Array.from({ length: count }, (_, i) => (
                <div key={i} className="grid gap-2.5 px-4 py-4 md:grid-cols-[1fr_10rem_12rem_5rem] md:items-center md:px-5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-2 w-full rounded-full" />
                  <Skeleton className="hidden h-5 w-14 justify-self-end md:block" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
