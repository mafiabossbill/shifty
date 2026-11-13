import { GalleryScreen } from "@/components/design/gallery-screen";
import { SampleEmptyScreen } from "@/components/design/sample-screen";

/** The shell around an empty page, with an empty store. */
export default function Page() {
  return (
    <GalleryScreen pathname="/sessions" sample="empty">
      <SampleEmptyScreen />
    </GalleryScreen>
  );
}
