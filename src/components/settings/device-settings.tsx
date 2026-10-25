import { SmartphoneIcon } from "lucide-react";

import { DemoLink } from "./demo-link";
import { SettingsGroup, SettingsHeader } from "./parts";

/**
 * This device. The PWA lane mounts <InstallGuide /> and <PlatformCapabilities /> from src/components/pwa/**
 * in the marked slots below (orchestrator wires them; this lane must not create those components).
 */
export function DeviceSettings() {
  return (
    <div className="grid gap-8">
      <SettingsHeader title="This device" description="Installing SHIFTY, and what this browser can and can't do." />

      <SettingsGroup title="Install" id="install">
        {/* PWA SLOT: <InstallGuide /> (src/components/pwa/install-guide) mounts here. */}
        <PwaPlaceholder text="Install steps for this device will appear here." />
      </SettingsGroup>

      <SettingsGroup title="What this browser supports" id="capabilities">
        {/* PWA SLOT: <PlatformCapabilities /> (src/components/pwa/platform-capabilities) mounts here. */}
        <PwaPlaceholder text="Notifications, badges and storage support for this browser will appear here." />
      </SettingsGroup>

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

function PwaPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground" data-pwa-slot>
      <SmartphoneIcon className="size-4 shrink-0" aria-hidden />
      {text}
    </div>
  );
}
