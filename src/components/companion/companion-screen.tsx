"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useTheme } from "@/components/theme/theme-provider";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { ACHIEVEMENTS } from "@/lib/rewards";
import { achievementRows } from "@/lib/settings/companion";
import { xpLog } from "@/lib/settings/ledger";

import { AchievementsList } from "./achievements-list";
import { Celebration, useUnseenAchievements } from "./celebration";
import { CompanionHero } from "./companion-hero";
import { HowXpWorks } from "./how-xp";
import { Room, Wardrobe } from "./item-grid";
import { LevelCard } from "./level-card";
import { RhythmCard } from "./rhythm-card";
import { achievementName, useCompanion } from "./use-companion";
import { XpLog } from "./xp-log";

const TABS = [
  { value: "wardrobe", label: "Wardrobe" },
  { value: "room", label: "Room" },
  { value: "achievements", label: "Achievements" },
  { value: "xp", label: "XP log" },
] as const;
type Tab = (typeof TABS)[number]["value"];
const isTab = (v: string | null): v is Tab => TABS.some((t) => t.value === v);

export function CompanionScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: Tab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "wardrobe";
  const { resolvedTheme } = useTheme();

  const m = useCompanion();
  const earnedForSeen = React.useMemo(() => m.rewards?.achievements.map((a) => ({ code: a.code as string, earnedAt: a.earnedAt })) ?? [], [m.rewards]);
  const { unseen, dismiss } = useUnseenAchievements(earnedForSeen, m.view.ready, m.view.demo);
  const celebrating = unseen.length > 0;
  const mood = m.moodWith(celebrating);

  const sessionExists = React.useCallback((id: string) => Boolean(m.view.state.sessions[id] && m.view.state.sessions[id].deletedAt === null), [m.view.state.sessions]);
  const achievements = React.useMemo(() => achievementRows(ACHIEVEMENTS, m.rewards?.achievements ?? m.view.profile.achievements), [m.rewards, m.view.profile.achievements]);
  const log = React.useMemo(() => xpLog(m.view.profile.ledger, m.zone, m.today, achievementName), [m.view.profile.ledger, m.zone, m.today]);

  if (!m.view.ready) return <CompanionSkeleton />;

  const setTab = (next: Tab) => {
    const q = new URLSearchParams(params.toString());
    if (next === "wardrobe") q.delete("tab");
    else q.set("tab", next);
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  return (
    <div className="grid gap-5 lg:gap-6">
      {m.view.loadError ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-ink">
          {m.view.loadError} Mochi can&apos;t load your history on this browser. Check that storage isn&apos;t blocked, then reload.
        </p>
      ) : null}
      {celebrating ? <Celebration codes={unseen} look={m.look} name={m.companion.name} onDismiss={dismiss} /> : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] lg:gap-6">
        <CompanionHero name={m.companion.name} look={m.look} mood={mood} localHour={m.localHour} level={m.level} />
        <div className="grid content-start gap-5 lg:gap-6">
          <LevelCard progress={m.rewards?.progress ?? null} level={m.level} totalXp={m.rewards?.totalXp ?? 0} look={m.look} theme={resolvedTheme} />
          <RhythmCard rhythm={m.rewards?.rhythm ?? null} />
        </div>
      </div>

      <section className="grid gap-4" aria-label="Mochi's things">
        <SegmentedControl ariaLabel="Companion section" value={tab} onValueChange={setTab} options={TABS} fullWidth className="max-w-xl" />
        <div className="min-w-0">
          {tab === "wardrobe" ? <Wardrobe look={m.look} unlocked={m.unlocked} theme={resolvedTheme} /> : null}
          {tab === "room" ? <Room look={m.look} unlocked={m.unlocked} theme={resolvedTheme} /> : null}
          {tab === "achievements" ? <AchievementsList rows={achievements} zone={m.zone} today={m.today} sessionExists={sessionExists} /> : null}
          {tab === "xp" ? <XpLog rows={log} sessionExists={sessionExists} /> : null}
        </div>
      </section>

      <HowXpWorks />
    </div>
  );
}

export function CompanionSkeleton() {
  return (
    <div className="grid gap-5 lg:gap-6" aria-busy="true" aria-label="Loading Mochi">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] lg:gap-6">
        <Skeleton className="aspect-[4/3] max-h-[480px] min-h-[300px] rounded-card" />
        <div className="grid content-start gap-5 lg:gap-6">
          <Skeleton className="h-56 rounded-card" />
          <Skeleton className="h-52 rounded-card" />
        </div>
      </div>
      <Skeleton className="h-11 max-w-xl rounded-control" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
