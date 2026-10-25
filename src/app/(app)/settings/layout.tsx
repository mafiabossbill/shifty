import { Suspense } from "react";

import { Page } from "@/components/shell/page";
import { SettingsSideNav, SettingsSideNavFrame } from "@/components/settings/settings-shell";

/** Settings shell: grouped side nav from 1024px; phones and tablets use the /settings menu and back links. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Page>
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <Suspense fallback={<SettingsSideNavFrame />}>
          <SettingsSideNav />
        </Suspense>
        <div className="mx-auto w-full max-w-[760px] min-w-0 lg:mx-0">{children}</div>
      </div>
    </Page>
  );
}
