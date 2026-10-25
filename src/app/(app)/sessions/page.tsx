import type { Metadata } from "next";
import { Suspense } from "react";

import { ListSkeleton, SessionsScreen } from "@/components/sessions/sessions-screen";

export const metadata: Metadata = { title: "Sessions" };

/** Static shell; the list reads the URL query and this device's store (works offline). */
export default function SessionsPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <SessionsScreen />
    </Suspense>
  );
}
