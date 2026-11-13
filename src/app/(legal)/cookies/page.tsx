import type { Metadata } from "next";

import { APP_CONFIG } from "@/lib/app-config";
import { ACTIVE_ORG_COOKIE } from "@/lib/current-user";
import { LEGAL } from "@/lib/legal";
import { THEME_STORAGE_KEY } from "@/lib/theme";

export const metadata: Metadata = { title: "Cookie notice" };

/**
 * Strictly necessary storage only, so no consent banner is needed. Adding analytics, ads or any
 * third-party script that sets cookies means a consent banner and an update to this table first.
 * Names come from the code, so renaming a cookie updates the notice.
 */
const STORAGE = [
  { name: "sb-…-auth-token", kind: "Cookie", purpose: "Keeps you signed in (set by our sign-in provider)", duration: "Until you sign out or the session expires" },
  { name: ACTIVE_ORG_COOKIE, kind: "Cookie", purpose: "Remembers which workspace you are working in", duration: "1 year" },
  { name: THEME_STORAGE_KEY, kind: "Local storage", purpose: "Remembers light or dark mode on this device", duration: "Until you clear it" },
] as const;

export default function CookiesPage() {
  return (
    <>
      <h1>Cookie notice</h1>
      <p className="text-muted-foreground">Effective {LEGAL.effectiveDate}</p>
      <p>
        {APP_CONFIG.name} uses only the cookies and browser storage it needs to work. There are no advertising or tracking
        cookies and nothing is shared with advertisers, so we don&apos;t ask for cookie consent.
      </p>
      {/* A list, not a table: four columns do not fit a phone, and each row reads as one sentence. */}
      <dl className="mb-4 border-b text-body">
        {STORAGE.map((s) => (
          <div key={s.name} className="grid gap-1 border-t py-3">
            <dt className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono font-semibold">{s.name}</span>
              <span className="text-caption text-muted-foreground">
                {s.kind} · kept {s.duration.charAt(0).toLowerCase() + s.duration.slice(1)}
              </span>
            </dt>
            <dd>{s.purpose}</dd>
          </div>
        ))}
      </dl>
      <p>
        Blocking these in your browser will sign you out or reset your settings. If we ever add optional cookies we will ask
        first and update this page.
      </p>
    </>
  );
}
