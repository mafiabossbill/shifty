import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageLoading } from "@/components/shell/page-loading";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = { title: "Design gallery", robots: { index: false } };

/**
 * The design gallery: the system and every screen, rendered with sample data and no session, so
 * they can be looked at while they are built (`npm run design:shots` photographs them).
 * Development only: a production build answers 404 here, and the path is not public there
 * (src/lib/public-paths.ts).
 */
export default function DesignLayout({ children }: LayoutProps<"/design">) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <ConfirmProvider>
      <Suspense fallback={<PageLoading />}>{children}</Suspense>
      <Toaster position="bottom-right" />
    </ConfirmProvider>
  );
}
