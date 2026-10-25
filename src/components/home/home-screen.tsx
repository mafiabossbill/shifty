"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { moodFor } from "@/components/mochi/mood";
import { Page } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { greetingFor, lastCompleted, mochiStatusFor } from "@/lib/home/view-model";
import { nudgesFor } from "@/lib/shifts/nudges";
import type { SessionDetails } from "@/lib/shifts/types";
import { useNow, useShift, useShiftStore } from "@/lib/store/react";
import { ShiftActionError } from "@/lib/store/store";
import { sessionMetrics } from "@/lib/time/allocate";
import { wallClock } from "@/lib/time/zone";

import { ActiveHero } from "./active-hero";
import { ClockInHero } from "./clock-in-hero";
import { RecapSheet } from "./recap-sheet";
import { CompanionMochi, tapHaptic, useHydrated, useRewards } from "./shared";
import { LastSessionCard, NudgeCard, RhythmCard, WeekCard } from "./side-cards";

const CELEBRATE_MS = 2_500;
/** A08: the clock-out undo grace. */
const UNDO_MS = 8_000;

function subscribeWide(cb: () => void) {
  const mq = window.matchMedia("(min-width: 1024px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const isWide = () => window.matchMedia("(min-width: 1024px)").matches;

function errorText(error: unknown, fallback: string) {
  return error instanceof ShiftActionError ? error.message : fallback;
}

export function HomeScreen() {
  const view = useShift();
  const store = useShiftStore();
  const now = useNow(1000);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const wide = useSyncExternalStore(subscribeWide, isWide, () => false);
  const hydrated = useHydrated();

  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [celebrateUntil, setCelebrateUntil] = useState(0);
  const [recapId, setRecapId] = useState<string | null>(null);
  // The store's undo window (A08: 8 s from the tap). Kept here too because `view.undo` only appears
  // after the store's next recompute; `undoClockOut()` stays the authority and refuses once expired.
  const [undoFallback, setUndoFallback] = useState<{ sessionId: string; until: number } | null>(null);

  const { settings, companion } = view.profile;
  const zone = settings.reportingTimeZone;
  const active = view.active;
  const last = useMemo(() => lastCompleted(view.sessions), [view.sessions]);
  const rewards = useRewards(view.state, view.profile, now);
  const prompt = params.get("action") === "clock-in" && !active;

  const clearPrompt = useCallback(() => {
    if (params.get("action") === null) return;
    const next = new URLSearchParams(params);
    next.delete("action");
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  // A clock-in from elsewhere (other tab, shortcut already used) closes the prompt.
  useEffect(() => {
    if (active && params.get("action") === "clock-in") clearPrompt();
  }, [active, params, clearPrompt]);

  const nudges = useMemo(() => (active ? nudgesFor(active, settings, now, view.dismissedNudges) : []), [active, settings, now, view.dismissedNudges]);

  if (!view.ready || !hydrated) return <HomeSkeleton />;

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (error) {
      toast.error(errorText(error, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const clockIn = async (details: SessionDetails | null) => {
    tapHaptic(settings.haptics);
    const ok = await run(() => store.clockIn(details ?? {}), "Couldn't clock in. Try again.");
    if (ok) {
      setCelebrateUntil(store.now() + CELEBRATE_MS);
      clearPrompt();
    }
  };

  const clockOut = async () => {
    if (!active) return;
    tapHaptic(settings.haptics);
    const id = active.id;
    const tappedAt = store.now();
    const ok = await run(() => store.clockOut(), "Couldn't clock out. Try again.");
    if (ok) {
      setUndoFallback({ sessionId: id, until: tappedAt + UNDO_MS });
      setRecapId(id);
    }
  };

  const retryLocation = async () => {
    if (!active) return;
    setLocating(true);
    try {
      await store.retryLocation(active.id);
    } finally {
      setLocating(false);
    }
  };

  const localHour = wallClock(now, zone).hour;
  const status = mochiStatusFor(active, last, now);
  const moodSession = active ?? (status === "just_finished" ? last : null);
  const moodNet = moodSession ? sessionMetrics(moodSession, now).netMs : 0;
  const mood = moodFor({
    status,
    localHour,
    netMs: moodNet,
    goalMs: (moodSession?.goalSeconds ?? settings.defaultGoalSeconds) * 1000,
    recentlyCelebrated: now < celebrateUntil,
  });
  const firstRun = view.sessions.length === 0 && view.trash.length === 0 && !active;
  const recapSession = recapId ? (view.state.sessions[recapId] ?? null) : null;
  const undo =
    view.undo && view.undo.sessionId === recapId ? view.undo : undoFallback && undoFallback.sessionId === recapId && recapSession?.endedAt !== null ? undoFallback : null;

  return (
    <Page>
      <header className="mb-4 flex items-center gap-3 lg:mb-6">
        {firstRun ? null : <CompanionMochi companion={companion} mood={mood.mood} size={48} className="shrink-0" />}
        <div className="grid min-w-0 gap-0.5">
          <h1 className="type-title truncate lg:type-display">{greetingFor(localHour, settings.displayName)}</h1>
          <p className="line-clamp-2 text-sm text-muted-foreground" aria-live="polite">
            {firstRun ? "I'm Mochi. I'll keep the time while you work." : mood.line}
          </p>
        </div>
      </header>


      <div className={firstRun ? "mx-auto grid max-w-xl gap-4" : "grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)] lg:items-start lg:gap-6"}>
        <div className="grid min-w-0 gap-4">
          {active ? (
            <ActiveHero
              session={active}
              now={now}
              clock={settings.clock}
              ringSize={wide ? 340 : 296}
              busy={busy}
              locating={locating}
              onStartBreak={() => void run(() => store.startBreak("rest"), "Couldn't start the break. Try again.")}
              onEndBreak={() => void run(() => store.endBreak(), "Couldn't end the break. Try again.")}
              onClockOut={() => void clockOut()}
              onRetryLocation={() => void retryLocation()}
            />
          ) : (
            <ClockInHero
              goalSeconds={settings.defaultGoalSeconds}
              zone={zone}
              localHour={localHour}
              projects={view.profile.projects}
              prompt={prompt}
              firstRun={firstRun}
              busy={busy}
              onClockIn={(d) => void clockIn(d)}
              onDismissPrompt={clearPrompt}
              mochi={firstRun ? <CompanionMochi companion={companion} mood={mood.mood} size={96} className="relative" /> : undefined}
            />
          )}
          {nudges.map((n) => (
            <NudgeCard key={n.id} nudge={n} onDismiss={() => void store.dismissNudge(n.id)} />
          ))}
          {firstRun ? (
            <p className="text-center text-sm text-muted-foreground">
              Want to look around first?{" "}
              <Button
                variant="link"
                className="h-auto p-0 font-medium"
                // A full load on purpose: the in-memory demo store is chosen when the app starts.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                onClick={() => window.location.assign("/?demo=1")}
              >
                Try the demo
              </Button>
            </p>
          ) : null}
        </div>

        {firstRun ? null : (
          <div className="grid min-w-0 gap-4">
            {!active && last ? <LastSessionCard session={last} now={now} clock={settings.clock} projects={view.profile.projects} /> : null}
            <WeekCard sessions={view.sessions} now={Math.floor(now / 30_000) * 30_000} zone={zone} weekStart={settings.weekStart} />
            <RhythmCard rewards={rewards} />
          </div>
        )}
      </div>

      {view.loadError ? (
        <p role="alert" className="mt-6 rounded-card bg-danger-soft px-4 py-3 text-sm text-danger-ink">
          This browser blocked storage ({view.loadError}). SHIFTY can&apos;t keep your sessions here; allow site storage or leave private browsing, then reload.
        </p>
      ) : null}

      <RecapSheet
        session={recapSession}
        open={recapId !== null}
        onOpenChange={(open) => {
          if (!open) setRecapId(null);
        }}
        now={now}
        clock={settings.clock}
        companion={companion}
        summary={recapSession ? rewards.summaryForSession(recapSession.id) : null}
        undoUntil={undo?.until ?? null}
        onUndo={async () => {
          const undone = await store.undoClockOut();
          if (undone) {
            setRecapId(null);
            toast.success("Clock-out undone. You're still clocked in.");
          }
          return undone;
        }}
        onSave={async (changes) => {
          if (!recapSession) return;
          await store.annotate(recapSession.id, changes);
        }}
      />
    </Page>
  );
}

/** Same frames as the real screen, so nothing jumps when the device store opens. */
export function HomeSkeleton() {
  return (
    <Page>
      <div aria-busy aria-label="Loading your shift">
        <div className="mb-4 flex items-center gap-3 lg:mb-6">
          <Skeleton className="size-12 rounded-full" />
          <div className="grid gap-2">
            <Skeleton className="h-6 w-48 lg:h-9 lg:w-72" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)] lg:gap-6">
          <div className="grid justify-items-center gap-6 rounded-card border border-border bg-card p-6 lg:min-h-[560px] lg:content-center lg:p-8">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="size-60 rounded-full sm:size-64" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="grid content-start gap-4">
            <Skeleton className="h-40 rounded-card" />
            <Skeleton className="h-44 rounded-card" />
          </div>
        </div>
      </div>
    </Page>
  );
}
