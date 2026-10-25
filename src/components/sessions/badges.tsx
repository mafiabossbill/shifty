import { ArchiveIcon, MapPinIcon, PencilLineIcon, KeyboardIcon } from "lucide-react";

import { Pill, SessionStatusPill, SyncStatePill } from "@/components/ui/status-pill";
import type { SessionRow } from "@/lib/sessions/rows";
import { PROJECT_COLORS } from "@/lib/sessions/rows";
import { sessionStatus } from "@/lib/shifts/types";
import type { SessionSyncState, SyncMode } from "@/lib/store/store";
import { cn } from "@/lib/utils";

export function ProjectDot({ color, className }: { color: keyof typeof PROJECT_COLORS | null | undefined; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", !color && "border border-border-strong", className)}
      style={color ? { backgroundColor: PROJECT_COLORS[color] } : undefined}
    />
  );
}

/** Sync badge only when it tells something: on an account, "Local" means not sent yet. */
export function syncBadge(state: SessionSyncState | undefined, mode: SyncMode) {
  if (state === "syncing") return <SyncStatePill state="syncing" size="sm" />;
  if (state === "attention") return <SyncStatePill state="needs_attention" size="sm" />;
  if (state === "local" && mode !== "device" && mode !== "unconfigured") return <SyncStatePill state="local" label="Local" size="sm" />;
  return null;
}

/** Status, origin, corrected, archived and sync, in that order. */
export function SessionBadges({
  row,
  sync,
  mode,
  showPlace = true,
  className,
}: {
  row: SessionRow;
  sync: SessionSyncState | undefined;
  mode: SyncMode;
  showPlace?: boolean;
  className?: string;
}) {
  const s = row.session;
  const status = sessionStatus(s);
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}>
      {status !== "completed" ? <SessionStatusPill status={status} size="sm" /> : null}
      {s.origin === "manual" ? (
        <Pill size="sm" icon={<KeyboardIcon />}>
          Manual
        </Pill>
      ) : null}
      {s.revisions.length > 0 ? (
        <Pill size="sm" tone="info" icon={<PencilLineIcon />}>
          Corrected
        </Pill>
      ) : null}
      {s.archivedAt !== null ? (
        <Pill size="sm" icon={<ArchiveIcon />}>
          Archived
        </Pill>
      ) : null}
      {syncBadge(sync, mode)}
      {showPlace && row.place.label ? (
        <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{row.place.label}</span>
        </span>
      ) : null}
    </div>
  );
}
