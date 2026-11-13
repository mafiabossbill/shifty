"use client";

import { useEffect } from "react";

/*
 * Last-resort boundary. It replaces the root layout, so the stylesheet and the tokens may not have
 * loaded: it is styled inline with system fonts and the browser's own colours (CanvasText on
 * Canvas follows light and dark by itself). Plain, readable, one way out.
 */
// design-ok-file: replaces the root layout when it fails, so no stylesheet or token is available; inline styles with system colours only
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", event: "ui.global_error", message: (error as Error)?.message }));
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, colorScheme: "light dark", color: "CanvasText", background: "Canvas" }}>
        <h1 style={{ fontSize: 22, lineHeight: "28px", fontWeight: 600, margin: 0 }}>Something went wrong</h1>
        <p style={{ fontSize: 16, lineHeight: "24px", margin: "4px 0 0" }}>The page couldn&apos;t load. Your data is safe.</p>
        <button type="button" onClick={() => retry()} style={{ marginTop: 16, minHeight: 44, padding: "0 16px", fontSize: 16, fontWeight: 600 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
