"use client";

import { Suspense } from "react";

import { BottomNav } from "@/components/shell/bottom-nav";
import { PageLoading } from "@/components/shell/page-loading";
import { SidebarFrame } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { APP_CONFIG } from "@/lib/app-config";
import { ROLE_CAPABILITIES } from "@/lib/permissions";

const WORKSPACES = [{ id: "sample-workspace", name: APP_CONFIG.name }];
const CAPABILITIES = [...ROLE_CAPABILITIES.admin];

/**
 * The signed-in shell with sample values instead of a session, so a gallery screen is seen the
 * way a person sees it: sidebar on desktop, bottom bar on phones. `pathname` is the real route
 * the screen lives at, so its navigation item shows as current.
 */
export function GalleryShell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <SidebarFrame organizationName={APP_CONFIG.name} workspaces={WORKSPACES} activeWorkspaceId="sample-workspace" capabilities={CAPABILITIES} pathname={pathname} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={{ name: "Amina Hassan", role: "admin" }} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Suspense fallback={<PageLoading />}>{children}</Suspense>
        </main>
        <BottomNav organizationName={APP_CONFIG.name} workspaces={WORKSPACES} activeWorkspaceId="sample-workspace" capabilities={CAPABILITIES} />
      </div>
    </div>
  );
}
