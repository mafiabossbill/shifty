"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { signedXp, type XpLogRow } from "@/lib/settings/ledger";
import { cn } from "@/lib/utils";

const PAGE = 40;

/** Every XP row, newest first, in plain words. Adjustments are neutral, never "lost". */
export function XpLog({ rows, sessionExists }: { rows: XpLogRow[]; sessionExists: (id: string) => boolean }) {
  const [shown, setShown] = React.useState(PAGE);
  if (rows.length === 0) {
    return (
      <EmptyState
        variant="inline"
        title="No XP yet. Your first session starts the log."
        action={
          <Button asChild variant="soft">
            <Link href="/">Go to Home</Link>
          </Button>
        }
      />
    );
  }
  const groups: { date: string; label: string; total: number; rows: XpLogRow[] }[] = [];
  for (const r of rows.slice(0, shown)) {
    const last = groups.at(-1);
    if (last && last.date === r.date) {
      last.rows.push(r);
      last.total += r.xp;
    } else groups.push({ date: r.date, label: r.dateLabel, total: r.xp, rows: [r] });
  }
  return (
    <div className="grid gap-3">
      <ul className="overflow-hidden rounded-xl border border-border bg-card">
        {groups.map((g) => (
          <li key={g.date} className="border-b border-border last:border-b-0">
            <h3 className="flex items-center justify-between bg-raised/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
              <span>{g.label}</span>
              <span className="tabular">{signedXp(g.total)} XP</span>
            </h3>
            <ul className="divide-y divide-border">
              {g.rows.map((r) => {
                const linked = r.sourceSessionId && sessionExists(r.sourceSessionId);
                const content = (
                  <>
                    <span className={cn("w-12 shrink-0 text-sm font-semibold tabular", r.adjustment ? "text-muted-foreground" : "text-success-ink")}>{r.amount}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{r.text}</span>
                    {linked ? <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
                  </>
                );
                return (
                  <li key={r.key}>
                    {linked ? (
                      <Link href={`/sessions/view?id=${r.sourceSessionId}`} aria-label={`${r.amount} ${r.text}, ${r.dateLabel}. Open the session`} className="flex min-h-11 items-center gap-3 px-3.5 py-2 hover:bg-accent focus-ring">
                        {content}
                      </Link>
                    ) : (
                      <div className="flex min-h-11 items-center gap-3 px-3.5 py-2">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      {rows.length > shown ? (
        <Button variant="secondary" className="justify-self-center" onClick={() => setShown((n) => n + PAGE)}>
          Show more ({rows.length - shown} older)
        </Button>
      ) : null}
    </div>
  );
}
