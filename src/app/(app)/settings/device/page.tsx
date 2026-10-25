import type { Metadata } from "next";

import { DeviceSettings } from "@/components/settings/device-settings";

export const metadata: Metadata = { title: "This device" };

export default function Page() {
  return <DeviceSettings />;
}
