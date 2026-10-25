"use client";

import { RotateCcwIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Page } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDuration } from "@/lib/format";
import { buildRows } from "@/lib/sessions/rows";
import { formatRange } from "@/lib/sessions/wording";
import { useNow, useShift, useShiftStore } from "@/lib/store/react";
import { daysBetween, localDateOf } from "@/lib/time/zone";

import { ProjectDot } from "./badges";
import { actionMessage } from "./errors";
import { ScreenHeader } from "./screen-header";
import { sessionHref } from "./session-row";

function deletedAgo(deletedAt: number, now: number, zone: string): string {
  const days = daysBetween(localDateOf(deletedAt, zone), localDateOf(now, zone));
  if (days <= 0) return "Deleted today";
  if (days === 1) return "Deleted yesterday";
  return `Deleted ${days} days ago`;
}

/** Sessions in the trash: they don't count anywhere and stay until restored or deleted for good. */
export function TrashScreen() {
  const view = useShift();
  const store = useShiftStore();
  const confirm = useConfirm();
  const now = useNow(300_000);
  const [busy, setBusy] = useState<string | null>(null);
  const { settings, projects } = view.profile;
  const rows = useMemo(() => buildRows(view.trash, now, projects), [view.trash, now, projects]);

  const run = async (id: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(id);
    try {
      await fn();
      toast.success(done);
    } catch (error) {
      toast.error(actionMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const purge = async (id: string, title: string) => {
    const ok = await confirm({ title: `Delete “${title}” forever?`, description: "This can't be undone. Its times, notes, locations and history are removed.", confirmLabel: "Delete forever", destructive: true });
    if (ok) await run(id, () => store.purge(id), "Deleted for good");
  };

  const emptyTrash = async () => {
    const ok = await confirm({
      title: `Delete all ${rows.length} sessions in the trash forever?`,
      description: "This can't be undone.",
      confirmLabel: "Empty trash",
      destructive: true,
    });
    if (!ok) return;
    setBusy("all");
    try {
      for (const r of rows) await store.purge(r.session.id);
      toast.success("Trash emptied");
    } catch (error) {
      toast.error(actionMessage(error));
    } finally {
      setBusy(null);
    }
  };

  if (!view.ready) {
    return (
      <Page width="narrow">
        <div className="grid gap-4" aria-busy="true" aria-label="Loading trash">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-48 rounded-card" />
        </div>
      </Page>
    );
  }

  return (
    <Page width="narrow">
      <ScreenHeader
        title="Trash"
        description="Sessions here don't count in Insights or rewards. They stay until you restore them or delete them for good."
        actions={
          rows.length > 1 ? (
            <Button variant="ghost" size="sm" className="text-danger-ink" disabled={busy !== null} onClick={emptyTrash}>
              <Trash2Icon />
              Empty trash
            </Button>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<Trash2Icon />}
          title="The trash is empty."
          action={
            <Button asChild variant="secondary">
              <Link href="/sessions">Back to sessions</Link>
            </Button>
          }
        />
      ) : (
        <Card padding="none" className="gap-0 overflow-hidden">
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const s = r.session;
              return (
                <li key={s.id} className="grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:px-5">
                  <Link href={sessionHref(s.id)} prefetch={false} className="grid min-w-0 gap-1 rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <ProjectDot color={r.project?.color} />
                      <span className="truncate font-medium">{r.title}</span>
                      <span className="ml-auto shrink-0 font-display font-semibold tabular sm:hidden">{formatDuration(r.metrics.netMs)}</span>
                    </span>
                    <span className="text-sm text-muted-foreground tabular">
                      {formatDate(r.anchor)} · {formatRange(s.startedAt, s.endedAt, s.reportingTimeZone, settings.clock)}
                      <span className="hidden sm:inline"> · {formatDuration(r.metrics.netMs)} net</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{deletedAgo(s.deletedAt ?? now, now, settings.reportingTimeZone)}</span>
                  </Link>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" className="max-sm:flex-1" disabled={busy !== null} onClick={() => run(s.id, () => store.restore(s.id), "Restored")}>
                      <RotateCcwIcon />
                      Restore
                    </Button>
                    <Button variant="ghost" size="sm" className="text-danger-ink max-sm:flex-1" disabled={busy !== null} onClick={() => purge(s.id, r.title)}>
                      <Trash2Icon />
                      Delete forever
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </Page>
  );
}
