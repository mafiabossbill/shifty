/**
 * Supportive reminders and the opt-in safety limit, as pure functions of a session and `now`.
 * Reminders suggest rest; they never praise long hours and never award anything.
 */
import { sessionMetrics } from "@/lib/time/allocate";

import type { Settings } from "./profile";
import type { ShiftSession } from "./types";

const H = 3_600_000;

export interface Nudge {
  id: string;
  kind: "milestone" | "break";
  title: string;
  body: string;
}

function milestoneCopy(hours: number, goalHours: number): { title: string; body: string } {
  if (hours < goalHours) return { title: `${hours} hours in`, body: "A good moment to stretch, drink some water and rest your eyes." };
  if (hours === goalHours) return { title: "You've reached your goal", body: "Anything from here is extra. Wrapping up soon would be kind to tomorrow-you." };
  return { title: `${hours} hours — that's a long one`, body: "Your goal is behind you. Please consider resting; SHIFTY will keep the time either way." };
}

export function nudgesFor(session: ShiftSession, settings: Pick<Settings, "reminderHours" | "breakNudgeMinutes">, now: number, dismissed: ReadonlySet<string>): Nudge[] {
  if (session.endedAt !== null || session.deletedAt !== null) return [];
  const m = sessionMetrics(session, now);
  const out: Nudge[] = [];
  const goalHours = Math.round(session.goalSeconds / 3600);
  const hours = [...new Set([...settings.reminderHours, goalHours])].sort((a, b) => b - a);
  // Only the latest milestone crossed, so reopening the app after hours shows one card, not five.
  const crossed = hours.find((h) => m.netMs >= h * H);
  if (crossed !== undefined) {
    const id = `${session.id}:h${crossed}`;
    if (!dismissed.has(id)) out.push({ id, kind: "milestone", ...milestoneCopy(crossed, goalHours) });
  }
  const onBreak = session.breaks.some((b) => b.endedAt === null);
  if (!onBreak && settings.breakNudgeMinutes > 0) {
    const lastRest = Math.max(session.startedAt, ...session.breaks.map((b) => b.endedAt ?? 0));
    const since = now - lastRest;
    const every = settings.breakNudgeMinutes * 60_000;
    if (since >= every) {
      const id = `${session.id}:b${lastRest}:${Math.floor(since / every)}`;
      if (!dismissed.has(id)) {
        out.push({ id, kind: "break", title: "Time for a break?", body: `You've worked ${Math.floor(since / H)}h ${Math.floor((since % H) / 60_000)}m without one. Even ten minutes helps.` });
      }
    }
  }
  return out;
}

/**
 * The instant net time reached `limitHours`, if it already has by `now`; null otherwise.
 * Used to clock out at exactly the limit (not at whenever the app next woke up).
 */
export function safetyLimitReachedAt(session: ShiftSession, limitHours: number | null, now: number): number | null {
  if (limitHours === null || session.endedAt !== null || session.deletedAt !== null) return null;
  const limit = limitHours * H;
  const m = sessionMetrics(session, now);
  if (m.netMs < limit) return null;
  let left = limit;
  for (const w of m.workIntervals) {
    const len = w.end - w.start;
    if (len >= left) return w.start + left;
    left -= len;
  }
  return null;
}

/** Same id on every device, so two devices applying the limit can't create two clock-outs. */
export function safetyClockOutId(sessionId: string): string {
  return `5afe7e00${sessionId.slice(8)}`;
}
