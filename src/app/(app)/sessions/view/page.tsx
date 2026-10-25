import type { Metadata } from "next";
import { Suspense } from "react";

import { DetailSkeleton, SessionDetailScreen } from "@/components/sessions/session-detail";

export const metadata: Metadata = { title: "Session" };

/** `/sessions/view?id=<uuid>` — a query param, not a dynamic segment, so the one static shell works offline. */
export default function SessionViewPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <SessionDetailScreen />
    </Suspense>
  );
}
