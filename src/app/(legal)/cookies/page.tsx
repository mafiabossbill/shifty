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
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Purpose</th>
            <th>Kept for</th>
          </tr>
        </thead>
        <tbody>
          {STORAGE.map((s) => (
            <tr key={s.name}>
              <td className="font-mono text-[12px]">{s.name}</td>
              <td>{s.kind}</td>
              <td>{s.purpose}</td>
              <td>{s.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Blocking these in your browser will sign you out or reset your settings. If we ever add optional cookies we will ask
        first and update this page.
      </p>
    </>
  );
}
