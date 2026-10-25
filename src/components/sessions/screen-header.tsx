import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * Header for the Sessions sub-pages (add, trash). Unlike PageHeader the title stays visible on phones,
 * because the top bar there only says "Sessions".
 */
export function ScreenHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 grid gap-2 lg:mb-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 justify-self-start text-muted-foreground">
        <Link href="/sessions">
          <ChevronLeftIcon />
          Sessions
        </Link>
      </Button>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="grid min-w-0 flex-1 gap-1">
          <h1 className="type-title md:type-display">{title}</h1>
          {description ? <p className="max-w-prose text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
