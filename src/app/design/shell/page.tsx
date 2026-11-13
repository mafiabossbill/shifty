import { GalleryScreen } from "@/components/design/gallery-screen";
import { SampleScreen } from "@/components/design/sample-screen";

/** The shell around a page built from the system, with the demo history in the store. */
export default function Page() {
  return (
    <GalleryScreen pathname="/sessions">
      <SampleScreen />
    </GalleryScreen>
  );
}
