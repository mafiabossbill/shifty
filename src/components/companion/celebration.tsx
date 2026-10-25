"use client";

import * as React from "react";
import { XIcon } from "lucide-react";

import { Mochi } from "@/components/mochi/mochi";
import type { AccessoryKey, HatKey, PaletteKey } from "@/components/mochi/parts";
import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { ACHIEVEMENTS } from "@/lib/rewards";
import { parseSeen, unseenAchievements } from "@/lib/settings/companion";
import type { EarnedAchievement } from "@/lib/shifts/profile";

import type { Look } from "./item-preview";

const KEY = "shifty:seen-achievements";

function readSeen(demo: boolean): Set<string> | null {
  try {
    return parseSeen(window.localStorage.getItem(demo ? `${KEY}:demo` : KEY));
  } catch {
    return new Set();
  }
}

function writeSeen(demo: boolean, codes: Iterable<string>) {
  try {
    window.localStorage.setItem(demo ? `${KEY}:demo` : KEY, JSON.stringify([...codes]));
  } catch {
    // Storage blocked: we may celebrate again next time. That's fine.
  }
}

/**
 * Newly earned achievements not yet seen on this device. The seen list is read once when the store is
 * ready; anything earned that isn't in it is celebrated once and written back, so it never shows again.
 * Demo mode keeps its own list.
 */
export function useUnseenAchievements(earned: readonly Pick<EarnedAchievement, "code" | "earnedAt">[], ready: boolean, demo: boolean) {
  const [baseline, setBaseline] = React.useState<Set<string> | null>(null);
  if (ready && baseline === null) setBaseline(readSeen(demo) ?? new Set());
  const unseen = baseline ? unseenAchievements(earned, baseline) : [];
  const key = unseen.join(",");
  React.useEffect(() => {
    if (!baseline || key === "") return;
    writeSeen(demo, [...baseline, ...key.split(",")]);
  }, [baseline, key, demo]);
  return { unseen, dismiss: () => setBaseline(new Set([...(baseline ?? []), ...earned.map((e) => e.code)])) };
}

export function Celebration({ codes, look, name, onDismiss }: { codes: string[]; look: Look; name: string; onDismiss: () => void }) {
  const { reducedMotion } = useTheme();
  const first = ACHIEVEMENTS.find((a) => a.code === codes[0]);
  if (!first) return null;
  const more = codes.length - 1;
  return (
    <div role="status" className="flex items-center gap-3 rounded-card border border-celebrate/30 bg-celebrate-soft/60 p-3 pr-2 sm:gap-4 sm:p-4">
      <div className="shrink-0">
        <Mochi
          size={72}
          mood="celebrating"
          palette={look.palette as PaletteKey}
          hat={look.hat as HatKey}
          accessory={look.accessory as AccessoryKey}
          animate={!reducedMotion}
          title={`${name}, celebrating`}
        />
      </div>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="type-eyebrow text-celebrate-ink">New achievement</p>
        <p className="font-display text-base font-semibold">{first.name}</p>
        <p className="text-sm text-muted-foreground">{first.description}</p>
        {more > 0 ? <p className="text-xs text-muted-foreground">And {more} more — see Achievements below.</p> : null}
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={onDismiss} className="self-start">
        <XIcon />
      </Button>
    </div>
  );
}
