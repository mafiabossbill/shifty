import type { Metadata } from "next";

import { PaySettings } from "@/components/settings/pay-settings";

export const metadata: Metadata = { title: "Pay" };

export default function Page() {
  return <PaySettings />;
}
