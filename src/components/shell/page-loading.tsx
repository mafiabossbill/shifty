import { Page } from "@/components/shell/page";
import { Skeleton } from "@/components/ui/skeleton";

/** Route loading state: the outline of a figure and a few rows. Never a full-screen spinner. */
export function PageLoading() {
  return (
    <Page>
      <div className="grid gap-6" aria-busy="true" aria-label="Loading">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      </div>
    </Page>
  );
}
