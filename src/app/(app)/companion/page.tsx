import type { Metadata } from "next";
import { Suspense } from "react";

import { CompanionScreen, CompanionSkeleton } from "@/components/companion/companion-screen";
import { Page, PageHeader } from "@/components/shell/page";

export const metadata: Metadata = { title: "Companion" };

export default function CompanionPage() {
  return (
    <Page>
      <PageHeader title="Companion" />
      <Suspense fallback={<CompanionSkeleton />}>
        <CompanionScreen />
      </Suspense>
    </Page>
  );
}
