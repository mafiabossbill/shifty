"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ChevronLeftIcon,
  EllipsisIcon,
  GlobeIcon,
  PencilIcon,
  RotateCcwIcon,
  SearchXIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Page } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDuration, formatStopwatch, spokenDuration, zoneAbbreviation } from "@/lib/format";
import { daySplit } from "@/lib/sessions/geometry";
import { buildRow } from "@/lib/sessions/rows";
import { FLAG_COPY, formatRange, goalCopy } from "@/lib/sessions/wording";
import { sessionStatus, type ShiftSession } from "@/lib/shifts/types";
import { useNow, useShift, useShiftStore } from "@/lib/store/react";
import type { StoreView } from "@/lib/store/store";
import { goalProgress } from "@/lib/time/allocate";
import { deviceTimeZone, localDateOf } from "@/lib/time/zone";

import { AnnotateFields } from "./annotate-fields";
import { AuditHistory } from "./audit-history";
import { ProjectDot, SessionBadges } from "./badges";
import { DayContributions } from "./day-contributions";
import { EditTimesSheet } from "./edit-times-sheet";
import { actionMessage } from "./errors";
import { LocationSection } from "./location-section";
import { RezoneSheet } from "./rezone-sheet";
import { SessionTimeline } from "./session-timeline";

export function SessionDetailScreen() {
  const params = useSearchParams();
  const id = params.get("id");
  const view = useShift();
  if (!view.ready) return <DetailSkeleton />;
  const session = id ? view.state.sessions[id] : undefined;
  if (!session) {
    return (
      <Page width="narrow">
        <BackLink />
        <h1 className="sr-only">Session not found</h1>
        <EmptyState
          icon={<SearchXIcon />}
          title="This session isn't on this device."
          description="It may have been deleted for good, or it was recorded on another device that hasn't synced yet."
          action={
            <Button asChild variant="secondary">
              <Link href="/sessions">Back to sessions</Link>
            </Button>
          }
        />
      </Page>
    );
  }
  return <SessionDetail key={session.id} session={session} view={view} />;
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
      <Link href="/sessions">
        <ChevronLeftIcon />
        Sessions
      </Link>
    </Button>
  );
}

/** Where the device was set, when it differs from the reporting zone (travel, a changed phone setting). */
function deviceZoneNotes(session: ShiftSession): string[] {
  const zone = session.reportingTimeZone;
  const start = session.startTimeZone;
  const end = session.endTimeZone;
  if (start !== zone && (end === null || end === start)) return [`Recorded with the device set to ${start}.`];
  const notes: string[] = [];
  if (start !== zone) notes.push(`Clocked in with the device set to ${start}.`);
  if (end && end !== zone) notes.push(`Clocked out with the device set to ${end}.`);
  return notes;
}

function SessionDetail({ session, view }: { session: ShiftSession; view: StoreView }) {
  const store = useShiftStore();
  const confirm = useConfirm();
  const router = useRouter();
  const running = session.endedAt === null;
  const now = useNow(running ? 1_000 : 60_000);
  const { settings, projects } = view.profile;
  const clock = settings.clock;
  const zone = session.reportingTimeZone;
  const deviceZone = useMemo(() => deviceTimeZone(), []);
  const row = buildRow(session, now, projects);
  const split = useMemo(() => daySplit(session, now), [session, now]);
  const status = sessionStatus(session);
  const trashed = session.deletedAt !== null;
  const thisYear = localDateOf(now, settings.reportingTimeZone).slice(0, 4);
  const goal = goalProgress(row.metrics.netMs, session.goalSeconds, now, status === "active");
  const [editing, setEditing] = useState(false);
  const [rezoning, setRezoning] = useState(false);

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) toast.success(done);
      return true;
    } catch (error) {
      toast.error(actionMessage(error));
      return false;
    }
  };

  const moveToTrash = async () => {
    const ok = await confirm({
      title: `Move “${row.title}” to the trash?`,
      description: "It stops counting in Insights and rewards. You can restore it from Trash until you delete it for good.",
      confirmLabel: "Move to trash",
      destructive: true,
    });
    if (!ok) return;
    if (await act(() => store.trash(session.id))) {
      toast.success("Moved to trash", { action: { label: "Undo", onClick: () => void act(() => store.restore(session.id), "Restored") } });
      router.push("/sessions");
    }
  };

  const purge = async () => {
    const ok = await confirm({
      title: `Delete “${row.title}” forever?`,
      description: "This can't be undone. Its times, notes, locations and history are removed.",
      confirmLabel: "Delete forever",
      destructive: true,
    });
    if (ok && (await act(() => store.purge(session.id), "Deleted for good"))) router.push("/sessions/trash");
  };

  const zones = [settings.reportingTimeZone, deviceZone, session.startTimeZone, session.endTimeZone ?? ""].filter(Boolean);
  const abbr = zoneAbbreviation(session.startedAt, zone);
  const archived = session.archivedAt !== null;

  return (
    <Page>
      <BackLink />

      <header className="mb-5 grid gap-3 lg:mb-7">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="grid min-w-0 flex-1 gap-1.5">
            <h1 className="flex min-w-0 items-center gap-2.5 type-title md:type-display">
              <ProjectDot color={row.project?.color} className="size-3" />
              <span className="min-w-0 break-words">{row.title}</span>
            </h1>
            <p className="text-sm text-muted-foreground tabular">
              {formatDate(row.anchor, { long: true, thisYear })} · {formatRange(session.startedAt, session.endedAt, zone, clock)}
              {zone !== deviceZone ? ` ${abbr}` : ""}
              {row.project ? ` · ${row.project.name}` : ""}
            </p>
          </div>
          {trashed ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => act(() => store.restore(session.id), "Restored")}>
                <RotateCcwIcon />
                Restore
              </Button>
              <Button variant="danger" size="sm" onClick={purge}>
                <Trash2Icon />
                Delete forever
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <PencilIcon />
                Edit times
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="More actions">
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setRezoning(true)}>
                    <GlobeIcon />
                    Change reporting timezone…
                  </DropdownMenuItem>
                  {!running ? (
                    <DropdownMenuItem onSelect={() => void act(() => store.annotate(session.id, { archived: !archived }), archived ? "Unarchived" : "Archived — it still counts in Insights")}>
                      {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
                      {archived ? "Unarchive" : "Archive"}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void moveToTrash()} className="text-danger-ink focus:text-danger-ink">
                    <Trash2Icon />
                    Move to trash
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        <SessionBadges row={row} sync={view.sessionSync[session.id]} mode={view.sync.mode} className="empty:hidden" />
      </header>

      {trashed ? <Notice>This session is in the trash. It doesn&apos;t count in Insights. Restore it to edit it again.</Notice> : null}
      {session.flags.map((f) => (
        <Notice key={f}>{FLAG_COPY[f]}</Notice>
      ))}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-5">
          <Card variant="hero" className="gap-5">
            <div className="flex items-start justify-between gap-4">
              <div className="grid min-w-0 gap-1">
                <p className="type-eyebrow text-muted-foreground">Net worked</p>
                <p className="font-display text-[3.25rem] leading-none font-semibold tracking-tight tabular md:text-6xl" aria-label={spokenDuration(row.metrics.netMs)}>
                  {running ? formatStopwatch(row.metrics.netMs) : formatDuration(row.metrics.netMs)}
                </p>
                <p className="text-sm text-muted-foreground">{goalCopy(row.metrics.netMs, session.goalSeconds, running)}</p>
              </div>
              <ProgressRing
                value={goal.ratio}
                overage={goal.goalMs ? goal.overageMs / goal.goalMs : 0}
                size={92}
                glow={false}
                label={`Net worked: ${spokenDuration(row.metrics.netMs)} of a ${spokenDuration(goal.goalMs)} goal`}
                className="shrink-0"
              >
                <span className="text-xs font-semibold tabular">{Math.round(goal.ratio * 100)}%</span>
              </ProgressRing>
            </div>
            <dl className="grid grid-cols-3 gap-2">
              <Stat label="Elapsed" value={formatDuration(row.metrics.elapsedMs)} />
              <Stat label="Breaks" value={row.metrics.breakMs ? formatDuration(row.metrics.breakMs) : "None"} hint={session.breaks.length > 1 ? `${session.breaks.length} breaks` : undefined} />
              <Stat label="Days" value={String(split.days.length)} hint={split.days.length > 1 ? "Crosses midnight" : undefined} />
            </dl>
            <div className="grid gap-1 border-t border-border pt-4 text-sm">
              <p>
                <span className="text-muted-foreground">Recorded with </span>
                {session.origin === "timer" ? "the timer" : "a manual entry (Manual)"}
              </p>
              <p>
                <span className="text-muted-foreground">Times in </span>
                {zone} ({abbr})
              </p>
              {deviceZoneNotes(session).map((n) => (
                <p key={n} className="text-muted-foreground">
                  {n}
                </p>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <SessionTimeline split={split} zone={zone} clock={clock} locations={session.locations} />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Day contributions</CardTitle>
              <p className="text-sm text-muted-foreground">How this session counts on each calendar day in Insights.</p>
            </CardHeader>
            <DayContributions split={split} netMs={row.metrics.netMs} thisYear={thisYear} />
          </Card>
        </div>

        <div className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <AnnotateFields session={session} projects={projects} disabled={trashed} />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <LocationSection session={session} clock={clock} readOnly={trashed} />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
              <p className="text-sm text-muted-foreground">{session.revisions.length ? "Every correction, with the old and new times." : "No corrections. The times are as recorded."}</p>
            </CardHeader>
            <AuditHistory session={session} clock={clock} thisYear={thisYear} />
          </Card>
        </div>
      </div>

      {!trashed ? (
        <>
          <EditTimesSheet open={editing} onOpenChange={setEditing} session={session} state={view.state} clock={clock} />
          <RezoneSheet open={rezoning} onOpenChange={setRezoning} session={session} suggested={zones} />
        </>
      ) : null}
    </Page>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="grid content-start gap-0.5 rounded-control bg-raised px-3 py-2.5">
      <dt className="text-2xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-base font-semibold whitespace-nowrap tabular sm:text-lg">{value}</dd>
      {hint ? <dd className="text-2xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

/** A calm warning line (flags, trash). */
function Notice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="mb-5 flex gap-3 rounded-control bg-warning-soft p-3.5 text-sm text-warning-ink">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <Page>
      <div className="grid gap-5" aria-busy="true" aria-label="Loading session">
        <Skeleton className="h-8 w-28" />
        <div className="grid gap-2">
          <Skeleton className="h-8 w-2/3 max-w-md" />
          <Skeleton className="h-4 w-1/2 max-w-xs" />
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="grid gap-5">
            <Skeleton className="h-64 rounded-card" />
            <Skeleton className="h-44 rounded-card" />
          </div>
          <div className="grid gap-5">
            <Skeleton className="h-80 rounded-card" />
          </div>
        </div>
      </div>
    </Page>
  );
}
