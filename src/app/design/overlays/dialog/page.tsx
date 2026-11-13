"use client";

import { SampleDialogContent } from "@/components/design/system-demos";
import { Dialog } from "@/components/ui/dialog";

/** A dialog, held open so it can be looked at: centred from 768px, a bottom sheet on phones. */
export default function Page() {
  return (
    <div className="p-4 md:p-6">
      <p className="text-muted-foreground">A dialog with a small form, held open.</p>
      <Dialog defaultOpen>
        <SampleDialogContent />
      </Dialog>
    </div>
  );
}
