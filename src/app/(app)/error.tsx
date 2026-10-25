"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** A failed page inside the shell: say what happened in plain words and offer a retry. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", event: "ui.page_error", message: (error as Error)?.message }));
  }, [error]);
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-sm font-semibold">This page couldn&apos;t load</h1>
      <p className="mt-1 text-muted-foreground">Check your connection and try again. Nothing you saved was lost.</p>
      <Button className="mt-4" variant="outline" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
