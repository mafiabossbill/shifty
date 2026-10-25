import type { Metadata } from "next";
import Link from "next/link";

import { APP_CONFIG } from "@/lib/app-config";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of service" };

/** Reads src/lib/legal.ts. Add a "Plans and payment" section when the product charges. Must stay public. */
export default function TermsPage() {
  const app = APP_CONFIG.name;
  return (
    <>
      <h1>Terms of service</h1>
      <p className="text-muted-foreground">Effective {LEGAL.effectiveDate}</p>
      <p>
        These terms are an agreement between you and {LEGAL.operator} (&quot;we&quot;) for your use of {app}. By creating an
        account or using {app} you accept them. If you use {app} for an organization, you accept them for that organization
        too and confirm you may do so.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least {LEGAL.minimumAge} and give accurate details.</li>
        <li>Keep your password private. You are responsible for what happens under your account; tell us at once if it is misused.</li>
        <li>Workspace admins control who has access and with which role, and can deactivate members.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Do not:</p>
      <ul>
        <li>break the law, or upload content you have no right to share;</li>
        <li>try to access other people&apos;s data or workspaces, or probe, scan or overload the service;</li>
        <li>upload malware, send spam, or use {app} to harass or deceive anyone;</li>
        <li>copy, resell or reverse-engineer the service, except where the law allows.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You and your organization own what you put into {app}. You give us permission to store, process and display it only
        to run the service for you, as described in the <Link href="/privacy">privacy policy</Link>. You can export your data
        at any time from Settings → Your data.
      </p>

      <h2>Our service</h2>
      <p>
        We work to keep {app} available and secure and to improve it, which can mean changing or removing features. We will
        give reasonable notice of changes that reduce what you can do. Planned maintenance is announced where possible.
      </p>

      <h2>Fees</h2>
      <p>
        If you buy a paid plan, the price, billing period and renewal terms shown when you buy apply. You can cancel before
        the next renewal; fees already paid are not refunded unless the law requires it.
      </p>

      <h2>Suspension and closing an account</h2>
      <p>
        You can delete your account at any time from Settings → Your data. We may suspend or close an account that breaks
        these terms or puts others at risk, and will tell you why unless the law prevents it. After closure, data is deleted
        as described in the privacy policy.
      </p>

      <h2>Disclaimers and liability</h2>
      <p>
        {app} is provided &quot;as is&quot;. To the extent the law allows, we are not liable for indirect or consequential loss,
        lost profits or lost data, and our total liability is limited to the amount you paid us in the 12 months before the
        claim. Nothing here limits liability that cannot be limited by law.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of {LEGAL.jurisdiction}, whose courts have jurisdiction over disputes. We would
        rather solve problems first: email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We will post updated terms here with a new effective date and tell you before material changes take effect. Using
        {` ${app}`} after that means you accept them.
      </p>
    </>
  );
}
