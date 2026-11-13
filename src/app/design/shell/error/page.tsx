"use client";

import AppError from "@/app/(app)/error";
import { GalleryScreen } from "@/components/design/gallery-screen";

const SAMPLE_ERROR = new Error("Sample error for the design gallery");
const retry = () => undefined;

/** The shell when a page fails: what happened, a retry, and that nothing was lost. */
export default function Page() {
  return (
    <GalleryScreen pathname="/insights">
      <AppError error={SAMPLE_ERROR} retry={retry} />
    </GalleryScreen>
  );
}
