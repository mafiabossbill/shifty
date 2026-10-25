import { LockIcon } from "lucide-react";

import { nextUnlocks } from "@/components/mochi/catalog";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { LevelProgress } from "@/lib/rewards/types";

import { ItemPreview, type Look } from "./item-preview";

/** Level, XP into the level and the next three things to unlock. */
export function LevelCard({ progress, level, totalXp, look, theme }: { progress: LevelProgress | null; level: number; totalXp: number; look: Look; theme: "dark" | "light" }) {
  const into = progress?.xpIntoLevel ?? 0;
  const span = progress?.levelSpan ?? 50;
  const ratio = progress?.ratio ?? 0;
  const upcoming = nextUnlocks(level, 3);
  return (
    <Card className="gap-5">
      <div className="grid gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="type-eyebrow text-muted-foreground">Level</p>
            <p className="type-stat tabular">{level}</p>
          </div>
          <p className="text-right text-sm text-muted-foreground">
            <span className="tabular font-medium text-foreground">{totalXp.toLocaleString("en")}</span> XP in total
          </p>
        </div>
        <div
          role="progressbar"
          aria-label={`Progress to level ${level + 1}`}
          aria-valuemin={0}
          aria-valuemax={span}
          aria-valuenow={into}
          aria-valuetext={`${into} of ${span} XP`}
          className="h-2.5 overflow-hidden rounded-full bg-track"
        >
          <div className="h-full rounded-full bg-brand transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.max(2, ratio * 100)}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="tabular">{into}</span> / <span className="tabular">{span}</span> XP · <span className="tabular">{progress?.xpToNext ?? span}</span> XP to level {level + 1}
        </p>
      </div>
      {upcoming.length > 0 ? (
        <div className="grid gap-2">
          <CardHeader>
            <CardTitle as="h3" className="text-sm">
              Coming up
            </CardTitle>
          </CardHeader>
          <ul className="grid grid-cols-3 gap-2">
            {upcoming.map((item) => (
              <li key={item.key} className="grid justify-items-center gap-1.5 rounded-xl bg-raised p-2 text-center">
                <div className="flex h-14 w-full items-center justify-center overflow-hidden">
                  <ItemPreview item={item} look={look} theme={theme} size={52} />
                </div>
                <span className="line-clamp-1 text-xs font-medium">{item.name}</span>
                <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                  <LockIcon className="size-3" aria-hidden />
                  Level {"level" in item.unlock ? item.unlock.level : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Everything on the level road is unlocked. Mochi is very proud of you.</p>
      )}
    </Card>
  );
}
