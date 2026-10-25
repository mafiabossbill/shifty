import type { Metadata } from "next";

import { SessionSettings } from "@/components/settings/session-settings";
import { SettingsMenu } from "@/components/settings/settings-menu";

export const metadata: Metadata = { title: "Settings" };

/** Phones/tablets: the grouped menu. From 1024px the side nav is the menu, so this shows Your sessions. */
export default function SettingsPage() {
  return (
    <>
      <h1 className="sr-only lg:hidden">Settings</h1>
      <div className="lg:hidden">
        <SettingsMenu />
      </div>
      <div className="hidden lg:block">
        <SessionSettings />
      </div>
    </>
  );
}
