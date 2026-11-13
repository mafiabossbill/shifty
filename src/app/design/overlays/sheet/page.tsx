"use client";

import { SampleSheetContent } from "@/components/design/system-demos";
import { Sheet } from "@/components/ui/sheet";

/** A sheet, held open: a drawer on the right from 768px, a bottom sheet on phones. */
export default function Page() {
  return (
    <div className="p-4 md:p-6">
      <p className="text-muted-foreground">A sheet with a record in it, held open.</p>
      <Sheet defaultOpen>
        <SampleSheetContent />
      </Sheet>
    </div>
  );
}
