"use client";

import { Suspense } from "react";

import { ActiveRibbon } from "@/components/session/active-ribbon";
import { BottomNavFrame } from "@/components/shell/bottom-nav";
import { PageLoading } from "@/components/shell/page-loading";
import { SidebarFrame } from "@/components/shell/sidebar";
import { SyncStatusSlot } from "@/components/shell/slots";
import { TopBarFrame } from "@/components/shell/topbar";

/**
 * The app's shell around a gallery screen, so it is seen the way a person sees it: sidebar from
 * 1024px, top bar and bottom bar below. `pathname` is the real route the screen lives at, so its
 * navigation item shows as current and the top bar names the place. The same parts as
 * src/app/(app)/layout.tsx; needs <GalleryStore> above it (the sync state and the ribbon read the store).
 * `ribbon={false}` leaves out the active-session ribbon.
 */
export function GalleryShell({ pathname, ribbon = true, children }: { pathname: string; ribbon?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <SidebarFrame pathname={pathname} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBarFrame pathname={pathname}>
          <SyncStatusSlot />
        </TopBarFrame>
        {ribbon ? (
          <div className="order-3 shrink-0 empty:hidden lg:order-1">
            <Suspense fallback={null}>
              <ActiveRibbon />
            </Suspense>
          </div>
        ) : null}
        <main className="order-2 min-h-0 flex-1 overflow-y-auto outline-none">
          <Suspense fallback={<PageLoading />}>{children}</Suspense>
        </main>
        <BottomNavFrame pathname={pathname} />
      </div>
    </div>
  );
}
