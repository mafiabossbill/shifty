"use client";

import { useEffect } from "react";

import { SAMPLE_CONFIRM } from "@/components/design/system-demos";
import { useConfirm } from "@/components/ui/confirm-dialog";

/** The confirm step of a delete, held open: the only place a red button appears. */
export default function Page() {
  const confirm = useConfirm();
  useEffect(() => {
    void confirm(SAMPLE_CONFIRM);
  }, [confirm]);
  return (
    <div className="p-4 md:p-6">
      <p className="text-muted-foreground">The confirm step of a delete, held open.</p>
    </div>
  );
}
