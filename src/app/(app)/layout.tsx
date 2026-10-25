import { Suspense } from "react";

import { BottomNav, BottomNavFrame } from "@/components/shell/bottom-nav";
import { PageLoading } from "@/components/shell/page-loading";
import { Sidebar, SidebarFrame } from "@/components/shell/sidebar";
import { ActiveRibbonSlot } from "@/components/shell/slots";
import { TopBar, TopBarFrame } from "@/components/shell/topbar";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";
import { ShiftProvider } from "@/lib/store/react";

/**
 * The SHIFTY shell. No server session reads: the app works signed out (device mode) and every
 * screen's data lives on the device, so the whole shell prerenders.
 *   phones/tablets  top bar (title + sync state) · content · active ribbon · floating bottom bar
 *   ≥1024px         232px sidebar · slim top bar · active ribbon · content (max 1200px)
 * Only the parts that read the URL sit behind <Suspense> with same-size frames (dynamic
 * routes like /sessions/[id] resolve the path at request time).
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <ShiftProvider>
      <ConfirmProvider>
        {/* dvh: the visible height on phones, whatever the browser's toolbars are doing. */}
        <div className="flex h-dvh overflow-hidden bg-background">
          <a
            href="#main"
            className="sr-only z-[60] rounded-control bg-primary px-4 py-2 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-[calc(0.75rem+env(safe-area-inset-top,0px))] focus:left-3"
          >
            Skip to content
          </a>
          <Suspense fallback={<SidebarFrame />}>
            <Sidebar />
          </Suspense>
          <div className="flex min-w-0 flex-1 flex-col">
            <Suspense fallback={<TopBarFrame />}>
              <TopBar />
            </Suspense>
            {/* One ribbon, moved by `order`: above the bottom bar on phones, under the top bar from 1024px. */}
            <div className="order-3 shrink-0 empty:hidden lg:order-1">
              <ActiveRibbonSlot />
            </div>
            <main id="main" tabIndex={-1} className="order-2 min-h-0 flex-1 overflow-y-auto outline-none">
              <Suspense fallback={<PageLoading />}>{children}</Suspense>
            </main>
            <Suspense fallback={<BottomNavFrame />}>
              <BottomNav />
            </Suspense>
          </div>
          <Toaster />
        </div>
      </ConfirmProvider>
    </ShiftProvider>
  );
}
