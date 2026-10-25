"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";

import { useNudgeNotifications, useSessionBadge } from "@/components/home/nudge-notifier";
import { useHydrated } from "@/components/home/shared";
import { formatStopwatch, spokenDuration } from "@/lib/format";
import { nudgesFor } from "@/lib/shifts/nudges";
import { sessionStatus, type ShiftSession } from "@/lib/shifts/types";
import type { Settings } from "@/lib/shifts/profile";
import { useNow, useShift } from "@/lib/store/react";
import { sessionMetrics } from "@/lib/time/allocate";
import { cn } from "@/lib/utils";

/**
 * The persistent active-session ribbon (every page except Home): pulsing dot + net time, tap → Home.
 * Mounted once in the shell, so it also fires the opt-in milestone notifications and keeps the app
 * badge ("1" while a session runs) wherever you are.
 */
export function ActiveRibbon() {
  const view = useShift();
  const pathname = usePathname();
  const hydrated = useHydrated();
  useSessionBadge(hydrated && view.ready ? view.active !== null : null);
  if (!hydrated || !view.ready || !view.active) return null;
  return <Ribbon session={view.active} settings={view.profile.settings} dismissed={view.dismissedNudges} hidden={pathname === "/"} />;
}

function Ribbon({ session, settings, dismissed, hidden }: { session: ShiftSession; settings: Settings; dismissed: ReadonlySet<string>; hidden: boolean }) {
  const now = useNow(1000);
  useNudgeNotifications(nudgesFor(session, settings, now, dismissed), settings.notifications);
  if (hidden) return null;

  const m = sessionMetrics(session, now);
  const onBreak = sessionStatus(session) === "on_break";
  const openBreak = session.breaks.find((b) => b.endedAt === null);
  const label = onBreak && openBreak ? `On break · ${formatStopwatch(now - openBreak.startedAt)}` : `Working · ${formatStopwatch(m.netMs)} net`;
  const spoken = onBreak && openBreak ? `On break for ${spokenDuration(now - openBreak.startedAt)}` : `Working, ${spokenDuration(m.netMs)} net`;

  return (
    <div className="px-[max(0.75rem,env(safe-area-inset-left,0px))] pt-1.5 lg:px-10 lg:pt-3">
      <Link
        href="/"
        aria-label={`${spoken}. Open Home`}
        className={cn(
          "mx-auto flex h-11 max-w-lg items-center gap-3 rounded-full border border-border bg-card/95 px-4 shadow-nav backdrop-blur-xl transition-colors hover:border-border-strong focus-ring",
          "lg:mx-0 lg:h-10 lg:max-w-none lg:rounded-control lg:shadow-none",
        )}
      >
        <span className={cn("size-2.5 shrink-0 rounded-full motion-safe:animate-live", onBreak ? "bg-celebrate text-celebrate" : "bg-brand text-brand")} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-medium tabular" aria-hidden>
          {label}
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  );
}
