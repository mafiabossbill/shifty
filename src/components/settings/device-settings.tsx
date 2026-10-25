"use client";

import { PlatformCapabilities } from "@/components/pwa/capabilities";
import { InstallGuide } from "@/components/pwa/install-guide";

import { DemoLink } from "./demo-link";
import { SettingsGroup, SettingsHeader, useSaveSettings } from "./parts";

/** This device: install steps and an honest capability table (both from the PWA lane), the lock-screen note, demo. */
export function DeviceSettings() {
  const save = useSaveSettings();
  return (
    <div className="grid gap-8">
      <SettingsHeader title="This device" description="Installing SHIFTY, and what this browser can and can't do." />

      {/* Renders nothing inside the installed app. */}
      <InstallGuide />

      <section className="grid gap-2.5" aria-labelledby="capabilities-title">
        <h2 id="capabilities-title" className="px-1 font-display text-base font-semibold tracking-tight">
          What this device supports
        </h2>
        <PlatformCapabilities
          onPermissionChange={(permission) => {
            // Allowing here turns reminders-as-notifications on; a refusal turns them off.
            if (permission === "granted") void save({ notifications: true });
            else if (permission === "denied") void save({ notifications: false });
          }}
        />
      </section>

      <SettingsGroup title="iPhone lock screen" id="live-activity">
        <div className="grid gap-2 py-4 text-sm">
          <p>SHIFTY can&apos;t show a Live Activity on the iPhone lock screen — web apps don&apos;t have access to it. The timer inside the app is always exact.</p>
          <p className="text-muted-foreground">Details: docs/LIVE_ACTIVITIES.md in the SHIFTY repository.</p>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Demo" id="demo">
        <div className="py-4">
          <DemoLink />
        </div>
      </SettingsGroup>
    </div>
  );
}
