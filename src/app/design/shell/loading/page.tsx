import { GalleryScreen } from "@/components/design/gallery-screen";
import { PageLoading } from "@/components/shell/page-loading";

/** The shell while a page loads: a skeleton in the page's place, never a full-screen spinner. */
export default function Page() {
  return (
    <GalleryScreen pathname="/insights">
      <PageLoading />
    </GalleryScreen>
  );
}
