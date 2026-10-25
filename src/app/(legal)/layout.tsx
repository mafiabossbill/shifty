import Link from "next/link";

import { APP_CONFIG } from "@/lib/app-config";
import { LEGAL, LEGAL_LINKS } from "@/lib/legal";

/** Public legal pages (required by privacy law, Meta, Google and app stores before an app can go live). */
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh bg-neutral-50 px-[max(1rem,env(safe-area-inset-left,0px))] pt-[max(2.5rem,env(safe-area-inset-top,0px))] pb-[max(3rem,env(safe-area-inset-bottom,0px))] dark:bg-background">
      <article className="mx-auto w-full max-w-2xl rounded-lg border bg-card p-6 text-[14px] leading-6 text-card-foreground sm:p-8 [&_h1]:mb-1 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-[15px] [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_table]:mb-3 [&_table]:w-full [&_td]:border-t [&_td]:py-1.5 [&_td]:pr-3 [&_td]:align-top [&_th]:pr-3 [&_th]:pb-1 [&_th]:text-left [&_th]:font-medium [&_ul]:mb-3">
        <Link href="/login" className="mb-6 flex min-h-11 w-fit items-center text-[13px] font-semibold md:block md:min-h-0">
          {APP_CONFIG.name}
        </Link>
        {children}
        <footer className="mt-8 border-t pt-4 text-[13px] text-muted-foreground">
          <nav aria-label="Legal" className="flex flex-wrap gap-x-4 md:gap-y-2">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-foreground md:min-h-0 md:min-w-0">
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="mt-3 mb-0!">
            {LEGAL.operator} · {LEGAL.address} · <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
          </p>
        </footer>
      </article>
    </div>
  );
}
