/**
 * Which mood Mochi shows and what it says. Pure: the caller passes the local hour and the session numbers.
 * Rule from the brief: never praise long hours. Past the goal Mochi gets sleepy and suggests rest.
 */
import type { MochiMood } from "./parts";

export type MochiStatus = "idle" | "active" | "on_break" | "just_finished";

export type MoodInput = {
  status: MochiStatus;
  /** 0–23 in the user's reporting timezone. */
  localHour: number;
  /** Net worked in the current (or just finished) session. 0 when idle. */
  netMs: number;
  /** The session goal; 0 or less means no goal. */
  goalMs: number;
  /** An achievement or level-up just happened. */
  recentlyCelebrated: boolean;
};

export type MoodResult = { mood: MochiMood; line: string };

const HOUR_MS = 3_600_000;

function isLateNight(hour: number): boolean {
  return hour >= 22 || hour < 5;
}

export function moodFor(input: MoodInput): MoodResult {
  const { status, recentlyCelebrated } = input;
  const hour = ((Math.floor(input.localHour) % 24) + 24) % 24;
  const net = Math.max(0, input.netMs);
  const goal = input.goalMs > 0 ? input.goalMs : 0;
  const overGoal = goal > 0 && net >= goal;
  // "A while": three quarters of the goal, or 12 hours when there is no goal.
  const longStretch = goal > 0 ? net >= goal * 0.75 : net >= 12 * HOUR_MS;

  switch (status) {
    case "just_finished":
      if (overGoal) return { mood: "resting", line: "That was a long one. Rest well and take it easy." };
      if (recentlyCelebrated) return { mood: "celebrating", line: "Something new unlocked! Now go and rest." };
      return { mood: "proud", line: "All logged. Time to switch off." };

    case "on_break":
      return { mood: "resting", line: "Break time. Stretch, sip some water." };

    case "active":
      if (overGoal) return { mood: "sleepy", line: "That's a long one. A break or rest would feel good." };
      if (recentlyCelebrated) return { mood: "celebrating", line: "Clocked in. Let's make it a good one." };
      if (longStretch) return { mood: "sleepy", line: "You've been at it a while. A short break helps." };
      if (isLateNight(hour)) return { mood: "sleepy", line: "Late one tonight. Go gently." };
      return { mood: "focused", line: "I'm right here with you." };

    case "idle":
    default:
      if (recentlyCelebrated) return { mood: "celebrating", line: "Yay! Something new for us." };
      if (isLateNight(hour)) return { mood: "sleepy", line: "Cosy night. Rest is part of the work." };
      if (hour < 12) return { mood: "happy", line: "Good morning. Ready when you are." };
      if (hour < 17) return { mood: "curious", line: "What are we up to today?" };
      return { mood: "resting", line: "A calm evening. Nice." };
  }
}
