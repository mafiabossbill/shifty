"use client";

import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { goalLabel } from "@/lib/settings/goal";
import { zoneOption } from "@/lib/settings/timezones";
import { formatMinor } from "@/lib/money";
import type { StoreView } from "@/lib/store/store";


import { DemoLink } from "./demo-link";
import { SETTINGS_GROUPS, type SettingsIcon as IconName } from "./nav";
import { SettingsIcon } from "./settings-icon";
import { useReadyShift } from "./use-ready-shift";

function summary(icon: IconName, view: StoreView): string {
  const s = view.profile.settings;
  switch (icon) {
    case "sessions":
      return `${goalLabel(s.defaultGoalSeconds)} goal · ${zoneOption(s.reportingTimeZone, Date.now()).city}`;
    case "pay":
      return s.payTracking ? (s.defaultPayRateMinor !== null ? `${formatMinor(s.defaultPayRateMinor, s.currency)} an hour` : "On") : "Off";
    case "places":
      return view.profile.places.length === 0 ? "None yet" : `${view.profile.places.length} remembered`;
    case "appearance":
      return `${s.theme === "system" ? "System" : s.theme === "dark" ? "Dark" : "Light"} · ${s.accent[0].toUpperCase()}${s.accent.slice(1)}`;
    case "privacy":
      return s.locationOnClockIn || s.locationOnClockOut ? "Location at clock-in" + (s.locationOnClockOut ? " and out" : "") : "Location off";
    case "data":
      return "Export, import, print";
    case "account":
      return view.demo ? "Demo" : view.sync.email ? view.sync.email : view.sync.mode === "unconfigured" ? "On this device" : "Not signed in";
    case "device":
      return "Install, notifications";
  }
}

/** The /settings index on phones and tablets: grouped rows that open each page. */
export function SettingsMenu() {
  const view = useReadyShift();
  return (
    <div className="grid gap-6">
      {SETTINGS_GROUPS.map((group) => (
        <section key={group.title} className="grid gap-2" aria-labelledby={`menu-${group.title}`}>
          <h2 id={`menu-${group.title}`} className="type-eyebrow px-1 text-muted-foreground">
            {group.title}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card shadow-card">
            {group.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="flex min-h-15 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent active:bg-accent focus-ring">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                    <SettingsIcon name={link.icon} className="size-4" />
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="text-[15px] font-medium">{link.label}</span>
                    {view.ready ? <span className="truncate text-xs text-muted-foreground">{summary(link.icon, view)}</span> : <Skeleton className="mt-1 h-3 w-28" />}
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="grid gap-2" aria-labelledby="menu-demo">
        <h2 id="menu-demo" className="type-eyebrow px-1 text-muted-foreground">
          Demo
        </h2>
        <div className="rounded-card border border-border bg-card p-4 shadow-card">
          <DemoLink />
        </div>
      </section>
    </div>
  );
}
