"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { parseQuery, serializeQuery, type SessionQuery } from "@/lib/sessions/query";

/** The list query lives in the URL; updates replace the entry (no history spam) and keep the scroll. */
export function useSessionQuery() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = useMemo(() => parseQuery(params), [params]);
  const setQuery = useCallback(
    (next: SessionQuery | ((q: SessionQuery) => SessionQuery)) => {
      const value = typeof next === "function" ? next(parseQuery(new URLSearchParams(window.location.search))) : next;
      // Keep the demo flag (and any param this screen doesn't own) out of the way: it lives in sessionStorage.
      router.replace(`${pathname}${serializeQuery(value)}`, { scroll: false });
    },
    [router, pathname],
  );
  return { query, setQuery };
}
