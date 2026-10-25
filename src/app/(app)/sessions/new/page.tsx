import type { Metadata } from "next";
import { Suspense } from "react";

import { ManualEntryScreen } from "@/components/sessions/manual-entry";
import { PageLoading } from "@/components/shell/page-loading";

export const metadata: Metadata = { title: "Add missed session" };

export default function NewSessionPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ManualEntryScreen />
    </Suspense>
  );
}
