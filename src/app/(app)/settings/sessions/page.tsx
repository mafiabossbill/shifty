import type { Metadata } from "next";

import { SessionSettings } from "@/components/settings/session-settings";

export const metadata: Metadata = { title: "Your sessions" };

export default function Page() {
  return <SessionSettings />;
}
