import type { Metadata } from "next";
import { ChartColumnBigIcon } from "lucide-react";

import { Page, PageHeader } from "@/components/shell/page";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Insights" };

/** Placeholder: the Insights lane replaces this body with ranges, rings and charts. */
export default function InsightsPage() {
  return (
    <Page>
      <PageHeader title="Insights" />
      <EmptyState icon={<ChartColumnBigIcon />} title="Your hours, days and patterns appear here after your first shift." />
    </Page>
  );
}
