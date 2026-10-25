import type { Metadata } from "next";
import { TimerIcon } from "lucide-react";

import { Page, PageHeader } from "@/components/shell/page";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Home" };

/** Placeholder: the Home lane replaces this body with the clock-in / active-session hero. */
export default function HomePage() {
  return (
    <Page>
      <PageHeader title="Home" />
      <EmptyState icon={<TimerIcon />} title="Your shift will show here once you clock in." />
    </Page>
  );
}
