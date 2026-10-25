import { Skeleton } from "@/components/ui/skeleton";

/** Route loading state: the outline of a page header, a hero and two cards. Never a full-screen spinner. */
export function PageLoading() {
  return (
    <div className="mx-auto grid w-full max-w-[1280px] gap-4 px-4 pt-2 pb-10 md:px-6 lg:px-10 lg:pt-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="hidden h-9 w-56 lg:block" />
      <Skeleton className="h-72 rounded-card" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-32 rounded-card" />
        <Skeleton className="h-32 rounded-card" />
      </div>
    </div>
  );
}
