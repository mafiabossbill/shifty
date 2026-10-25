"use client";

import { useEffect } from "react";

/** Last-resort boundary (replaces the root layout): plain, readable, one way out. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", event: "ui.global_error", message: (error as Error)?.message }));
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ fontSize: 14, color: "#555" }}>The page couldn&apos;t load. Your data is safe.</p>
        <button type="button" onClick={() => retry()} style={{ marginTop: 12, padding: "8px 14px" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
