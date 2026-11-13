"use client";

import { useEffect } from "react";

import { Page } from "@/components/shell/page";
import { Button } from "@/components/ui/button";

/** A failed page inside the shell: say what happened in plain words, reassure, and offer a retry. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", event: "ui.page_error", message: (error as Error)?.message }));
  }, [error]);
  return (
    <Page>
      <h1 className="text-title font-semibold">This page couldn&apos;t load</h1>
      <p className="mt-1 max-w-prose text-muted-foreground">Check your connection and try again. Nothing you saved was lost.</p>
      <Button className="mt-4" variant="outline" onClick={() => retry()}>
        Try again
      </Button>
    </Page>
  );
}
