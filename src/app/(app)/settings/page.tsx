import type { Metadata } from "next";
import { Settings2Icon } from "lucide-react";

import { Page, PageHeader, PageSection } from "@/components/shell/page";
import { AccentSetting, MotionSetting, ThemeSetting } from "@/components/theme/theme-setting";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Settings" };

/**
 * Placeholder: the Settings lane replaces this body (goal, timezone, reminders, privacy, data, account).
 * Appearance already works on this device.
 */
export default function SettingsPage() {
  return (
    <Page width="narrow">
      <PageHeader title="Settings" />
      <div className="grid gap-8">
        <PageSection title="Appearance">
          <Card className="gap-5">
            <div className="grid gap-2">
              <p className="text-sm font-medium">Theme</p>
              <ThemeSetting />
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Accent</p>
              <AccentSetting />
            </div>
            <div className="border-t border-border pt-2">
              <MotionSetting />
            </div>
          </Card>
        </PageSection>
        <EmptyState icon={<Settings2Icon />} title="Your goal, time zone, reminders and data controls come here next." />
      </div>
    </Page>
  );
}
