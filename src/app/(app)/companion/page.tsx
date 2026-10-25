import type { Metadata } from "next";
import { SparklesIcon } from "lucide-react";

import { Page, PageHeader } from "@/components/shell/page";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Companion" };

/** Placeholder: the Companion lane replaces this body with Mochi's habitat, levels and achievements. */
export default function CompanionPage() {
  return (
    <Page>
      <PageHeader title="Companion" />
      <EmptyState icon={<SparklesIcon />} title="Mochi moves in when you log your first shift." />
    </Page>
  );
}
