import type { Metadata } from "next";
import Link from "next/link";

import { APP_CONFIG } from "@/lib/app-config";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Delete your data" };

/** Public "data deletion instructions" URL (privacy law; Meta and Google app review ask for one). */
export default function DataDeletionPage() {
  return (
    <>
      <h1>Delete your data</h1>
      <h2>In the app (immediate)</h2>
      <ul>
        <li>Sign in to {APP_CONFIG.name} and open Settings → Your data.</li>
        <li>Download a copy of your data first if you want one.</li>
        <li>Choose Delete my account and type your email address to confirm.</li>
      </ul>
      <p>
        If you are the last admin of a workspace that other people still use, make someone else an admin first. A workspace
        where you are the only member is deleted with your account.
      </p>
      <h2>By email</h2>
      <p>
        Can&apos;t sign in? Email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> from the address on your
        account. We confirm within {LEGAL.retention.requestReplyWithinDays} days and finish within{" "}
        {LEGAL.retention.deletionCompletesWithinDays} days.
      </p>
      <h2>What is deleted</h2>
      <ul>
        <li>Your account, profile, sign-in details and sessions.</li>
        <li>Your memberships, and any workspace where you were the only member, with everything in it.</li>
      </ul>
      <h2>What stays</h2>
      <p>
        Records you created in a shared workspace belong to that organization and stay, with your name removed (for example
        audit history). Backups are overwritten within {LEGAL.retention.backupsDays} days. See the{" "}
        <Link href="/privacy">privacy policy</Link> for details.
      </p>
    </>
  );
}
