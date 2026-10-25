"use client";

import { FlaskConicalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { exitDemo } from "@/lib/demo/seed";
import { useHydrated } from "@/components/home/shared";
import { useShift } from "@/lib/store/react";

/** `?demo=1`: ten weeks of sample history in memory. Says so plainly and offers the way out. */
export function DemoBanner() {
  const view = useShift();
  const hydrated = useHydrated();
  // Nothing until hydrated: the server never knows about demo mode.
  if (!hydrated || !view.ready || !view.demo) return null;
  return (
    <div role="status" className="flex items-center gap-2 bg-celebrate-soft px-[max(1rem,env(safe-area-inset-left,0px))] py-1.5 text-sm text-celebrate-ink lg:px-10">
      <FlaskConicalIcon className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 truncate">
        <span className="font-medium">Demo data</span> — nothing is saved
      </p>
      <Button variant="ghost" size="sm" onClick={exitDemo} className="-my-1 shrink-0 text-celebrate-ink hover:bg-celebrate/15">
        Exit demo
      </Button>
    </div>
  );
}
