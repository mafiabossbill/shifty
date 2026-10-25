"use client";

import * as React from "react";
import { Check, Minus, X } from "lucide-react";

import {
  backgroundSyncSupported,
  badgeSupported,
  notificationSupport,
  requestNotifications,
  type NotificationSupport,
} from "@/lib/notify";
import { cn } from "@/lib/utils";

type Level = "yes" | "partial" | "no";

type Row = { feature: string; level: Level; status: string; detail: string };

type Snapshot = { notifications: NotificationSupport; badge: boolean; backgroundSync: boolean };

function snapshot(): Snapshot {
  return { notifications: notificationSupport(), badge: badgeSupported(), backgroundSync: backgroundSyncSupported() };
}

function reminderRow(n: NotificationSupport): Row {
  const feature = "Reminders while SHIFTY is open";
  if (!n.supported) {
    return n.needsInstall
      ? { feature, level: "no", status: "Install first", detail: "On iPhone, notifications only work in the home-screen app (iOS 16.4 or later)." }
      : { feature, level: "no", status: "Not supported", detail: "This browser can't show notifications. In-app prompts still appear." };
  }
  switch (n.permission) {
    case "granted":
      return { feature, level: "yes", status: "On", detail: "Rest prompts at your milestones while the app is open or recently used." };
    case "denied":
      return { feature, level: "no", status: "Blocked", detail: "Notifications are blocked for SHIFTY. Allow them in your browser or phone settings." };
    default:
      return { feature, level: "partial", status: "Not asked yet", detail: "Allow notifications to get rest prompts while the app is open." };
  }
}

function rows(s: Snapshot): Row[] {
  return [
    {
      feature: "Live timer in the app",
      level: "yes",
      status: "Works everywhere",
      detail: "Counted from the saved start time, so it is right even after the phone sleeps.",
    },
    reminderRow(s.notifications),
    s.badge
      ? { feature: "Home-screen badge", level: "yes", status: "Supported", detail: "The app icon can show a badge while a shift is running." }
      : {
          feature: "Home-screen badge",
          level: "no",
          status: s.notifications.needsInstall ? "Install first" : "Not supported",
          detail: s.notifications.needsInstall ? "Badges work in the installed app on iOS 16.4 or later." : "This browser has no app badge.",
        },
    s.backgroundSync
      ? { feature: "Background sync", level: "yes", status: "Supported", detail: "Saved changes can upload after you close the app." }
      : { feature: "Background sync", level: "partial", status: "When you open the app", detail: "Changes upload when SHIFTY is open and online." },
    {
      feature: "iOS Live Activities",
      level: "no",
      status: "Not available",
      detail: "Apple only offers Live Activities to native apps, not web apps. See docs/LIVE_ACTIVITIES.md.",
    },
  ];
}

const MARKS: Record<Level, { icon: React.ReactNode; label: string; tone: string }> = {
  yes: { icon: <Check className="size-4" aria-hidden />, label: "Yes", tone: "text-primary" },
  partial: { icon: <Minus className="size-4" aria-hidden />, label: "Partly", tone: "text-muted-foreground" },
  no: { icon: <X className="size-4" aria-hidden />, label: "No", tone: "text-destructive" },
};

export type PlatformCapabilitiesProps = {
  className?: string;
  /** Called after the person answers the notification permission prompt. */
  onPermissionChange?: (permission: NotificationSupport["permission"]) => void;
};

/** Honest "what works on this device" table for Settings. Client-only; renders nothing during SSR. */
export function PlatformCapabilities({ className, onPermissionChange }: PlatformCapabilitiesProps) {
  const [state, setState] = React.useState<Snapshot | null>(null);

  React.useEffect(() => {
    const update = () => setState(snapshot());
    update();
    // Permission can change in browser settings while the page is open.
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  if (!state) return null;

  const ask = async () => {
    const permission = await requestNotifications();
    setState(snapshot());
    onPermissionChange?.(permission);
  };
  const canAsk = state.notifications.supported && state.notifications.permission === "default";

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card text-card-foreground", className)}>
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">What SHIFTY can do on this device</caption>
        <colgroup>
          <col />
          <col className="w-[7.5rem] sm:w-40" />
        </colgroup>
        <thead className="sr-only">
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">On this device</th>
          </tr>
        </thead>
        <tbody>
          {rows(state).map((row) => {
            const mark = MARKS[row.level];
            const isReminder = row.feature.startsWith("Reminders");
            return (
              <tr key={row.feature} className="border-b border-border last:border-b-0">
                <th scope="row" className="py-3 pr-2 pl-4 align-top font-normal break-words">
                  <span className="block text-[15px] font-medium">{row.feature}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{row.detail}</span>
                  {isReminder && canAsk ? (
                    <button
                      type="button"
                      onClick={ask}
                      className="mt-2 inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      Allow notifications
                    </button>
                  ) : null}
                </th>
                <td className="py-3 pr-4 pl-2 align-top text-sm break-words">
                  <span className={cn("inline-flex items-start gap-1.5 font-medium", mark.tone)}>
                    <span className="mt-0.5 shrink-0">{mark.icon}</span>
                    <span>
                      <span className="sr-only">{mark.label}: </span>
                      {row.status}
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
