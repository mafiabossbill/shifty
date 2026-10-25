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
        We are the controller of your account data. When an organization (your employer or a client) gives you access, that
        organization decides what is recorded in its workspace and is responsible for that content; we process it on its
        behalf and only on its instructions.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Account: name, email address, password (stored only as a secure hash), your role and the workspaces you belong to.</li>
        <li>Content: records, comments and files you or your organization add to {app}.</li>
        <li>Usage and device: sign-in times, IP address, browser and device type, and error logs needed to run the service securely.</li>
        <li>Communications: messages you send us and the emails we send you about your account.</li>
        <li>Cookies: only the ones needed to keep you signed in and remember settings (see the <Link href="/cookies">cookie notice</Link>).</li>
      </ul>
      <p>We do not collect special categories of data (health, religion, biometrics) unless your organization chooses to record them.</p>

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
        Also: the admins of the workspaces you belong to (they see your name, email and role), and authorities when the law
        requires it. If we sell or merge the business, the new owner must honour this policy.
      </p>

      <h2>International transfers</h2>
      <p>
        Some providers store data outside {LEGAL.jurisdiction}. Where they do, we rely on safeguards required by law, such as
        standard contractual clauses and the provider&apos;s security commitments.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account and content: while your account or your organization&apos;s workspace is active.</li>
        <li>After you delete your account: removed within {LEGAL.retention.deletionCompletesWithinDays} days; records your organization must keep stay with your name removed.</li>
        <li>Server logs: {LEGAL.retention.serverLogsDays} days. Backups: overwritten within {LEGAL.retention.backupsDays} days.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit (HTTPS) and at rest. Every workspace is isolated by database rules, access is limited by
        role, and changes are recorded in an audit log. No system is perfectly secure: if a breach affects you, we will tell
        you and the regulator as the law requires.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>Access and portability: download everything about you from Settings → Your data, at any time.</li>
        <li>Correction: change your name in the app, or ask us or your workspace admin.</li>
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
