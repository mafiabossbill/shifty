"use client";

import { useEffect } from "react";

import { clearBadge, setBadge, showLocalNotification } from "@/lib/notify";
import type { Nudge } from "@/lib/shifts/nudges";

const KEY = "shifty-notified-nudges";

function notifiedIds(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function remember(id: string) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...notifiedIds().slice(-100), id]));
  } catch {
    // storage blocked: we may notify again after a reload, never more often than that
  }
}

/**
 * Fires a local notification once per nudge id, only when the person turned notifications on and the
 * browser granted permission (`showLocalNotification` checks again and never throws). The in-app card
 * is the primary reminder.
 */
export function useNudgeNotifications(nudges: readonly Nudge[], enabled: boolean) {
  const ids = nudges.map((n) => n.id).join("|");
  useEffect(() => {
    if (!enabled || nudges.length === 0 || typeof window === "undefined") return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const done = new Set(notifiedIds());
    for (const nudge of nudges) {
      if (done.has(nudge.id)) continue;
      remember(nudge.id);
      void showLocalNotification(nudge.title, { body: nudge.body, tag: nudge.id, url: "/" });
    }
    // `ids` captures the set of nudges; the array identity changes every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, enabled]);
}

/** App badge "1" while a session runs, cleared when none. `null` = store not open yet: leave it. */
export function useSessionBadge(running: boolean | null) {
  useEffect(() => {
    if (running === null) return;
    void (running ? setBadge(1) : clearBadge());
  }, [running]);
}
