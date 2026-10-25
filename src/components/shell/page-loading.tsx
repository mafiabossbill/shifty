import { Skeleton } from "@/components/ui/skeleton";

/** Route and section loading state: a quiet outline of a heading and rows, never a full-screen spinner. */
export function PageLoading() {
  return (
    <div className="grid gap-3 p-4 md:p-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-5 w-48" />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-8 opacity-60" />
      ))}
    </div>
  );
}
