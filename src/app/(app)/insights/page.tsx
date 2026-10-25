import type { Metadata } from "next";
import { Suspense } from "react";

import { InsightsScreen, InsightsSkeleton } from "@/components/insights/insights-screen";
import { Page, PageHeader } from "@/components/shell/page";

export const metadata: Metadata = { title: "Insights" };

/**
 * Insights: a static shell; every number is computed on the device from this browser's sessions.
 * The range, mode and session view live in the URL query (read on the client, behind Suspense).
 */
export default function InsightsPage() {
  return (
    <Page>
      <PageHeader title="Insights" />
      <Suspense fallback={<InsightsSkeleton />}>
        <InsightsScreen />
      </Suspense>
    </Page>
  );
}
