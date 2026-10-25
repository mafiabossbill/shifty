import type { Metadata } from "next";
import { Suspense } from "react";

import { HomeScreen, HomeSkeleton } from "@/components/home/home-screen";

export const metadata: Metadata = { title: "Home" };

/**
 * Home: clock in, the running session, and the recap. Static shell; everything comes from the device
 * store. The query (`?action=clock-in` shortcut) is read on the client, behind Suspense.
 */
export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeScreen />
    </Suspense>
  );
}
