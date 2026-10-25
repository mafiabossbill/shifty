import { Suspense } from "react";

import { BottomNav, BottomNavFrame } from "@/components/shell/bottom-nav";
import { PageLoading } from "@/components/shell/page-loading";
import { Sidebar, SidebarFrame } from "@/components/shell/sidebar";
import { Topbar, TopbarFrame } from "@/components/shell/topbar";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";
import { requireSession } from "@/lib/current-user";
import { viewerCapabilities } from "@/lib/permissions";

/**
 * The signed-in shell: sidebar (tablet/desktop), top bar, bottom bar (phones).
 * Anything that reads the session sits behind <Suspense> with a same-size frame
 * as fallback, so the shell prerenders and nothing jumps when data arrives.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <ConfirmProvider>
      {/* dvh: the visible height on phones, whatever the browser's toolbars are doing. */}
      <div className="flex h-dvh overflow-hidden">
        <Suspense fallback={<SidebarFrame />}>
          <SignedInSidebar />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <Suspense fallback={<TopbarFrame />}>
            <SignedInTopbar />
          </Suspense>
          <main className="min-h-0 flex-1 overflow-y-auto">
            <Suspense fallback={<PageLoading />}>{children}</Suspense>
          </main>
          <Suspense fallback={<BottomNavFrame />}>
            <SignedInBottomNav />
          </Suspense>
        </div>
        <Toaster position="bottom-right" />
      </div>
    </ConfirmProvider>
  );
}

async function SignedInSidebar() {
  const { user, organization, organizations } = await requireSession();
  return (
    <Sidebar
      organizationName={organization.name}
      workspaces={organizations}
      activeWorkspaceId={organization.id}
      capabilities={viewerCapabilities(user)}
    />
  );
}

async function SignedInTopbar() {
  const { user } = await requireSession();
  return <Topbar user={{ name: user.name, role: user.role }} />;
}

async function SignedInBottomNav() {
  const { user, organization, organizations } = await requireSession();
  return (
    <BottomNav
      organizationName={organization.name}
      workspaces={organizations}
      activeWorkspaceId={organization.id}
      capabilities={viewerCapabilities(user)}
    />
  );
}
