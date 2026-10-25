"use client";

import Link from "next/link";
import { FlaskConicalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { exitDemo } from "@/lib/demo/seed";
import { useShift } from "@/lib/store/react";


/** "Try demo data" (ten weeks, in memory only) or, in demo, "Exit demo". */
export function DemoLink({ compact = false }: { compact?: boolean }) {
  const view = useShift();
  // view.demo is known on the client before the store is ready; wait so the server HTML matches.
  if (!view.ready) return <Skeleton className={compact ? "h-9 w-32" : "h-20 w-full"} />;
  if (view.demo) {
    return (
      <div className="grid gap-2">
        {!compact ? <p className="text-sm text-muted-foreground">You&apos;re looking at demo data. Nothing here is saved.</p> : null}
        <Button variant={compact ? "outline" : "secondary"} size="sm" className="w-fit" onClick={() => exitDemo()}>
          <FlaskConicalIcon />
          Exit demo
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {!compact ? <p className="text-sm text-muted-foreground">Ten weeks of made-up shifts to look around with. Kept in memory only — your own data isn&apos;t touched.</p> : null}
      <Button asChild variant={compact ? "outline" : "secondary"} size="sm" className="w-fit">
        <Link href="/?demo=1">
          <FlaskConicalIcon />
          Try demo data
        </Link>
      </Button>
    </div>
  );
}
