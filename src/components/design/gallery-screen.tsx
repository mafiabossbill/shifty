"use client";

import { GalleryShell } from "@/components/design/gallery-shell";
import { GalleryStore, type GalleryPrepare, type GallerySample } from "@/components/design/gallery-store";
import { PageLoading } from "@/components/shell/page-loading";

/**
 * One real screen in the gallery: the device store with sample data, the app's shell, then the screen.
 *
 *   // src/app/design/screens/home/page.tsx          the full state
 *   <GalleryScreen pathname="/"><HomeScreen /></GalleryScreen>
 *
 *   // src/app/design/screens/home/empty/page.tsx    nothing recorded yet
 *   <GalleryScreen pathname="/" sample="empty"><HomeScreen /></GalleryScreen>
 *
 *   // src/app/design/screens/home/on-break/page.tsx  ("use client": `prepare` is a function)
 *   <GalleryScreen pathname="/" prepare={async (store) => { await store.clockIn(); await store.startBreak("meal"); }}>
 *
 * `pathname` is the screen's real route. Every state is its own page and is listed in the area's
 * registry file (src/lib/design-gallery/<area>.ts). More: factory/handoffs/redesign-r0.md § Gallery.
 */
export function GalleryScreen({
  pathname,
  sample = "demo",
  prepare,
  ribbon,
  children,
}: {
  pathname: string;
  sample?: GallerySample;
  prepare?: GalleryPrepare;
  ribbon?: boolean;
  children: React.ReactNode;
}) {
  return (
    <GalleryStore sample={sample} prepare={prepare} fallback={<PageLoading />}>
      <GalleryShell pathname={pathname} ribbon={ribbon}>
        {children}
      </GalleryShell>
    </GalleryStore>
  );
}
