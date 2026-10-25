import { ChevronDownIcon } from "lucide-react";

/** The short, honest version of the rewards rules. */
export function HowXpWorks() {
  return (
    <details className="group rounded-xl border border-border bg-card px-4 open:pb-4">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium focus-ring rounded-xl [&::-webkit-details-marker]:hidden">
        How XP works
        <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
      </summary>
      <div className="grid gap-2 text-sm text-muted-foreground">
        <p>Mochi rewards healthy habits, never long hours. A 20-hour shift earns exactly what an 8-hour one does.</p>
        <ul className="grid list-disc gap-1 pl-5">
          <li>Finishing a session of 30 minutes or more: +20 (two a day count)</li>
          <li>Logging it live with the timer: +5</li>
          <li>Taking a real break: +10</li>
          <li>Showing up for the day: +5 · a planned rest day: +5</li>
          <li>Reviewing your week: +15</li>
          <li>Achievements: +25 to +60, once each</li>
        </ul>
        <p>If you edit or delete a session, its XP is adjusted to match. Your level and unlocked items never go down.</p>
      </div>
    </details>
  );
}
