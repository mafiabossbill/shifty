import Link from "next/link";
import { AwardIcon, GiftIcon, SparkleIcon } from "lucide-react";

import { formatDate } from "@/lib/format";
import type { AchievementRow } from "@/lib/settings/companion";
import { localDateOf } from "@/lib/time/zone";
import { cn } from "@/lib/utils";

/** All ten, earned or not. Unearned ones say how — warmly, never greyed out. */
export function AchievementsList({ rows, zone, today, sessionExists }: { rows: AchievementRow[]; zone: string; today: string; sessionExists: (id: string) => boolean }) {
  const earned = rows.filter((r) => r.earned).length;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        <span className="tabular font-medium text-foreground">{earned}</span> of {rows.length} earned. They stay yours, even if you edit a session later.
      </p>
      <ul className="grid gap-2 md:grid-cols-2">
        {rows.map((r) => (
          <li key={r.code} className={cn("flex gap-3 rounded-xl border p-3.5", r.earned ? "border-celebrate/30 bg-celebrate-soft/40" : "border-dashed border-border-strong bg-card")}>
            <span
              className={cn("flex size-11 shrink-0 items-center justify-center rounded-full [&_svg]:size-5", r.earned ? "bg-celebrate-soft text-celebrate-ink" : "bg-brand-soft text-brand-strong")}
              aria-hidden
            >
              {r.earned ? <AwardIcon /> : <SparkleIcon />}
            </span>
            <div className="grid min-w-0 flex-1 gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <h3 className="font-display text-sm font-semibold">{r.name}</h3>
                <span className="text-xs text-muted-foreground tabular">+{r.xp} XP</span>
              </div>
              <p className="text-sm text-muted-foreground">{r.earned ? r.description : r.hint}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {r.earned && r.earnedAt !== null ? (
                  <span className="font-medium text-celebrate-ink">Earned {formatDate(localDateOf(r.earnedAt, zone), { thisYear: today.slice(0, 4) })}</span>
                ) : (
                  <span className="font-medium text-brand-strong">Not yet</span>
                )}
                {r.earned && r.sourceSessionId && sessionExists(r.sourceSessionId) ? (
                  <Link href={`/sessions/view?id=${r.sourceSessionId}`} className="inline-flex min-h-11 items-center rounded text-brand underline-offset-4 hover:underline focus-ring md:min-h-0">
                    See the session
                  </Link>
                ) : null}
                {r.reward ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <GiftIcon className="size-3" aria-hidden />
                    {r.earned ? "Unlocked" : "Unlocks"}: {r.reward.name}
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
