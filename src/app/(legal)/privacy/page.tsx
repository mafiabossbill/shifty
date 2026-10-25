import type { Metadata } from "next";
import Link from "next/link";

import { APP_CONFIG } from "@/lib/app-config";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy policy" };

/** Reads src/lib/legal.ts; `npm run legal:check` blocks release while placeholders remain. Must stay public. */
export default function PrivacyPage() {
  const app = APP_CONFIG.name;
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="text-muted-foreground">Effective {LEGAL.effectiveDate}</p>
      <p>
        {app} is run by {LEGAL.operator}, {LEGAL.address} (&quot;we&quot;). This policy explains what personal data we
        collect, why, who we share it with, how long we keep it and the rights you have. Questions:{" "}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>

      <h2>Who is responsible</h2>
      <p>
        {app} is a personal work-time tracker. We are the controller of your account and of the tracking data you sync. Your
        sessions are private to you: nobody else on {app} — not a workspace admin, not another member — can see your shifts,
        locations, notes, pay or ratings.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Account (only if you create one): name, email address, password (stored only as a secure hash).</li>
        <li>
          Work time: when each session started and ended, breaks, the timezone used for your reports, goals, titles, notes,
          tags, projects, corrections you make (with the reason) and the device events behind them.
        </li>
        <li>
          Location — only if you allow it, and only at the moment you clock in, clock out or tap &quot;Try again&quot;: coordinates,
          their accuracy and the time they were captured, plus the name of a place you saved yourself. {app} never tracks you in
          the background and never sends coordinates to a mapping or geocoding service.
        </li>
        <li>Optional: hourly pay rate (for estimates), mood and energy ratings, remembered places, companion and reward progress.</li>
        <li>Usage and device: sign-in times, IP address, browser and device type, and error logs needed to run the service securely.</li>
        <li>Cookies: only the ones needed to keep you signed in and remember settings (see the <Link href="/cookies">cookie notice</Link>).</li>
      </ul>
      <p>
        Without an account, everything stays in your browser on this device and nothing is sent to us. Signing out or erasing
        the device deletes that local copy.
      </p>

      <h2>Why we use it, and on what basis</h2>
      <ul>
        <li>To provide the service you or your organization signed up for (performance of a contract).</li>
        <li>To keep the service secure, prevent abuse and fix problems (legitimate interests).</li>
        <li>To send account emails such as confirmations, password resets and invitations (contract).</li>
        <li>To meet legal obligations such as tax records or lawful requests from authorities (legal obligation).</li>
        <li>Anything else, such as product news, only with your consent, which you can withdraw at any time.</li>
      </ul>
      <p>We do not sell personal data, use it for advertising or make automated decisions that have legal effects on you.</p>

      <h2>Who we share it with</h2>
      <p>Service providers that process data for us under contract, only for the purposes above:</p>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Purpose</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {LEGAL.processors.map((p) => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td>{p.purpose}</td>
              <td>{p.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Also: authorities when the law requires it. Workspace admins see only your name, email and role — never your tracking
        data. If we sell or merge the business, the new owner must honour this policy.
      </p>

      <h2>International transfers</h2>
      <p>
        Some providers store data outside {LEGAL.jurisdiction}. Where they do, we rely on safeguards required by law, such as
        standard contractual clauses and the provider&apos;s security commitments.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account and tracking data: until you delete it. Sessions you delete go to the trash until you empty it.</li>
        <li>Location points: 90 days by default; choose 30 days, a year or &quot;keep&quot; in Settings → Privacy, or delete any or all of them there at any time.</li>
        <li>After you delete your account: everything is removed within {LEGAL.retention.deletionCompletesWithinDays} days.</li>
        <li>Server logs: {LEGAL.retention.serverLogsDays} days. Backups: overwritten within {LEGAL.retention.backupsDays} days.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit (HTTPS) and at rest. Database rules let only you read your tracking data, and every
        correction you make is kept in your own history. No system is perfectly secure: if a breach affects you, we will tell
        you and the regulator as the law requires.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>Access and portability: download everything about you from Settings → Your data, at any time.</li>
        <li>Correction: edit any session (with a reason, kept in its history) or your name in the app.</li>
        <li>Deletion: delete your account from Settings → Your data (see <Link href="/data-deletion">how deletion works</Link>).</li>
        <li>Objection and restriction: ask us to stop or limit a use of your data.</li>
        <li>Withdrawing consent: for anything based on consent, at any time, without affecting what came before.</li>
        <li>Complaint: to {LEGAL.regulator}. We would like the chance to help first.</li>
      </ul>
      <p>
        Email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> from your account&apos;s address. We reply within{" "}
        {LEGAL.retention.requestReplyWithinDays} days and may ask you to confirm your identity.
      </p>

      <h2>Children</h2>
      <p>
        {app} is not for people under {LEGAL.minimumAge}. We do not knowingly collect their data; if we learn we have, we
        delete it.
      </p>

      <h2>Changes</h2>
      <p>
        We will post changes here with a new effective date, and email you before material changes take effect.
      </p>
    </>
  );
}
