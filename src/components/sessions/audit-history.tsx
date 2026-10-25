import { formatInstant, type ClockFormat } from "@/lib/format";
import { describeChanges } from "@/lib/sessions/wording";
import type { ShiftSession } from "@/lib/shifts/types";

/** Corrections, newest first, in plain words; the original start is always kept. */
export function AuditHistory({ session, clock, thisYear }: { session: ShiftSession; clock: ClockFormat; thisYear: string }) {
  const zone = session.reportingTimeZone;
  const revisions = [...session.revisions].reverse();
  return (
    <ol className="grid gap-0">
      {revisions.map((rev) => {
        const lines = describeChanges(rev.previous, rev.updated, zone, clock);
        return (
          <li key={rev.id} className="relative grid gap-1.5 border-l-2 border-border pb-5 pl-4 last:pb-3">
            <span className="absolute top-1 -left-[5px] size-2 rounded-full bg-info" aria-hidden />
            <p className="text-xs text-muted-foreground tabular">Corrected {formatInstant(rev.at, zone, clock, thisYear)}</p>
            <p className="text-sm">“{rev.reason}”</p>
            {lines.length ? (
              <ul className="grid gap-1 text-sm text-foreground/85 tabular">
                {lines.map((l) => (
                  <li key={l} className="rounded-md bg-raised px-2.5 py-1.5">
                    {l}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
      <li className="relative grid gap-1 border-l-2 border-border pl-4">
        <span className="absolute top-1 -left-[5px] size-2 rounded-full bg-border-strong" aria-hidden />
        <p className="text-xs text-muted-foreground tabular">{formatInstant(session.createdAt, zone, clock, thisYear)}</p>
        <p className="text-sm">
          {session.origin === "timer" ? "Recorded with the timer" : "Added by hand"}
          {session.originalStartedAt !== session.startedAt ? `, starting ${formatInstant(session.originalStartedAt, zone, clock, thisYear)}` : ""}
        </p>
      </li>
    </ol>
  );
}
