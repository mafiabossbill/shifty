import type { Metadata } from "next";
import { HistoryIcon } from "lucide-react";

import { Page, PageHeader } from "@/components/shell/page";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Sessions" };

/** Placeholder: the Sessions lane replaces this body with the history timeline. */
export default function SessionsPage() {
  return (
    <Page>
      <PageHeader title="Sessions" />
      <EmptyState icon={<HistoryIcon />} title="Every shift you finish is listed here, newest first." />
    </Page>
  );
}
