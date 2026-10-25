import { CalendarCheckIcon, MoonStarIcon, SnowflakeIcon, SunIcon } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RhythmResult } from "@/lib/rewards/types";

const TODAY: Record<RhythmResult["todayStatus"], { icon: React.ReactNode; text: string }> = {
  logged: { icon: <CalendarCheckIcon />, text: "Today is logged. Nice and steady." },
  pending: { icon: <SunIcon />, text: "Today is still open — no pressure." },
  rest: { icon: <MoonStarIcon />, text: "Rest day. Rest counts too." },
};

/** The forgiving rhythm: planned days in a row, rest days never break it, freezes cover a missed day. */
export function RhythmCard({ rhythm }: { rhythm: RhythmResult | null }) {
  const current = rhythm?.current ?? 0;
  const best = rhythm?.best ?? 0;
  const freezes = rhythm?.freezesAvailable ?? 0;
  const today = TODAY[rhythm?.todayStatus ?? "pending"];
  const lead =
    current > 0 ? `${current} planned day${current === 1 ? "" : "s"} in a row.` : best > 0 ? `A fresh start. Your best is ${best} days.` : "Your rhythm starts with your next planned day.";
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle as="h3">Rhythm</CardTitle>
        <CardDescription>{lead}</CardDescription>
      </CardHeader>
      <dl className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-raised p-3">
          <dt className="type-eyebrow text-muted-foreground">Now</dt>
          <dd className="type-title tabular">{current}</dd>
        </div>
        <div className="rounded-xl bg-raised p-3">
          <dt className="type-eyebrow text-muted-foreground">Best</dt>
          <dd className="type-title tabular">{best}</dd>
        </div>
        <div className="rounded-xl bg-raised p-3">
          <dt className="type-eyebrow flex items-center gap-1 text-muted-foreground">
            <SnowflakeIcon className="size-3" aria-hidden />
            Freezes
          </dt>
          <dd className="type-title tabular">{freezes}</dd>
        </div>
      </dl>
      <p className="flex items-center gap-2 text-sm [&_svg]:size-4 [&_svg]:text-brand">
        {today.icon}
        {today.text}
      </p>
      <p className="text-xs text-muted-foreground">A freeze quietly covers a planned day you miss. You earn one every 7 logged days (up to 2).</p>
    </Card>
  );
}
