/** The default session goal as hours + minutes (1 minute … 48 hours, net worked). */
export const MIN_GOAL_SECONDS = 60;
export const MAX_GOAL_SECONDS = 48 * 3600;

export function splitGoal(seconds: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.round(seconds / 60));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export type GoalParse = { ok: true; seconds: number } | { ok: false; error: string };

/** Parses what was typed in the two boxes. Blank counts as 0. */
export function parseGoal(hoursText: string, minutesText: string): GoalParse {
  const h = hoursText.trim() === "" ? 0 : Number(hoursText.trim());
  const m = minutesText.trim() === "" ? 0 : Number(minutesText.trim());
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0) return { ok: false, error: "Enter whole hours and minutes." };
  if (m > 59) return { ok: false, error: "Minutes go up to 59." };
  const seconds = h * 3600 + m * 60;
  if (seconds < MIN_GOAL_SECONDS) return { ok: false, error: "The goal must be at least 1 minute." };
  if (seconds > MAX_GOAL_SECONDS) return { ok: false, error: "The goal can be at most 48 hours." };
  return { ok: true, seconds };
}

/** "16h", "7h 30m", "45m" */
export function goalLabel(seconds: number): string {
  const { hours, minutes } = splitGoal(seconds);
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
