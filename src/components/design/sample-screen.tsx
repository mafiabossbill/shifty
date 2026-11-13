import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { Page, PageHeader, PageSection } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatTile } from "@/components/ui/stat-tile";
import { Pill, SessionStatusPill } from "@/components/ui/status-pill";

/*
 * A specimen, not a product screen: how a page is put together from the system inside the shell.
 * One primary action, a few figures, a list whose rows are divided by lines (not boxed one by one),
 * 32px between sections and 12px inside them. Fixed sample text, written to stress the layout:
 * a long title, a missing value, a running session.
 */

const ROWS = [
  { id: "1", title: "Night shift at the depot", when: "Today, 18:02", meta: "9h 12m so far", status: "active" as const },
  { id: "2", title: "Warehouse stock count for the Dar es Salaam, Arusha and Mwanza depots before the year-end audit", when: "Mon 9 Nov, 18:00 – Tue 10:00", meta: "16h net · crosses midnight" },
  { id: "3", title: "Untitled session", when: "Sat 7 Nov, 07:30 – 15:10", meta: "7h 10m net", manual: true },
];

export function SampleScreen() {
  return (
    <Page>
      <PageHeader
        title="Sessions"
        description="Every shift you have recorded, newest first."
        actions={
          <Button>
            <PlusIcon />
            Add session
          </Button>
        }
      />
      <div className="grid gap-8">
        <PageSection title="This week">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            <StatTile label="Net worked" value="41h 20m" delta={{ value: "+2h 10m", direction: "up", label: "vs last week" }} href="/sessions" />
            <StatTile label="Sessions" value="3" href="/sessions" />
            <StatTile label="Breaks taken" value="5" delta={{ value: "+2", direction: "up", sentiment: "positive", label: "vs last week" }} />
            <StatTile label="Earned" value="—" hint="Pay tracking is off" />
          </div>
          <div className="grid max-w-md gap-1.5">
            <ProgressBar value={0.575} label="Tonight's goal: 9h 12m of 16h" valueText="57 percent, 6h 48m to go" />
            <p className="text-caption text-muted-foreground">9h 12m of 16h tonight · 6h 48m to go</p>
          </div>
        </PageSection>
        <PageSection
          title="Recent"
          action={
            <Button asChild variant="link" size="sm">
              <Link href="/sessions">See all sessions</Link>
            </Button>
          }
        >
          <ul className="divide-y border-y">
            {ROWS.map((row) => (
              <li key={row.id} className="grid gap-1 py-3 md:grid-cols-[1fr_auto] md:items-center md:gap-4">
                <div className="grid min-w-0 gap-0.5">
                  <p className="truncate font-semibold">{row.title}</p>
                  <p className="text-caption text-muted-foreground">
                    {row.when} · {row.meta}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {row.status ? <SessionStatusPill status={row.status} /> : null}
                  {row.manual ? <Pill dot={false}>Added by hand</Pill> : null}
                </div>
              </li>
            ))}
          </ul>
        </PageSection>
      </div>
    </Page>
  );
}

/** The same page with nothing in it: what will appear, and the first action. */
export function SampleEmptyScreen() {
  return (
    <Page>
      <PageHeader title="Sessions" />
      <EmptyState
        title="No sessions yet"
        description="Each shift you clock shows up here, with its breaks and its split across days."
        action={
          <Button asChild>
            <Link href="/">Clock in</Link>
          </Button>
        }
      />
    </Page>
  );
}
