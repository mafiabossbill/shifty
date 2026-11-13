import Link from "next/link";

import { BrandLockup } from "@/components/shell/brand-mark";
import { LEGAL, LEGAL_LINKS } from "@/lib/legal";

/*
 * Reading pages: text that is read, not scanned. One column at reading size (`text-prose`, 18/28)
 * and at most about 70 characters a line (`max-w-prose`), left-aligned, no box. Headings are small
 * and sit closer to the text below them than to the text above. Links inside the text are underlined.
 */
const proseClass = [
  "max-w-prose text-prose",
  "[&_h1]:mb-2 [&_h1]:text-heading [&_h1]:font-semibold [&_h1]:tracking-tight",
  "[&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-title [&_h2]:font-semibold",
  "[&_p]:mb-4 [&_ul]:mb-4 [&_ul]:grid [&_ul]:gap-2 [&_li]:ml-6 [&_li]:list-disc",
  "[&_a]:underline [&_a]:decoration-control [&_a]:underline-offset-4 [&_a:hover]:decoration-foreground",
  "[&_table]:mb-4 [&_table]:w-full [&_table]:text-body [&_td]:border-t [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top",
  "[&_th]:pr-4 [&_th]:pb-2 [&_th]:text-left [&_th]:text-caption [&_th]:font-normal [&_th]:text-muted-foreground",
].join(" ");

/** Public legal pages (required by privacy law, Meta, Google and app stores before an app can go live). */
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh bg-background px-page pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(3rem,env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto w-full max-w-prose">
        <Link href="/login" className="inline-flex min-h-11 w-fit items-center rounded-md" aria-label="SHIFTY sign in">
          <BrandLockup />
        </Link>
        <article className={`${proseClass} pt-8 md:pt-12`}>{children}</article>
        <footer className="mt-12 border-t pt-4 text-caption text-muted-foreground">
          <nav aria-label="Legal" className="flex flex-wrap gap-x-4">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center rounded-sm hover:text-foreground hover:underline md:min-h-8">
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="mt-2">
            {LEGAL.operator} · {LEGAL.address} ·{" "}
            <a href={`mailto:${LEGAL.contactEmail}`} className="underline decoration-control underline-offset-4 hover:text-foreground">
              {LEGAL.contactEmail}
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
