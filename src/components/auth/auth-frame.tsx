import Link from "next/link";

import { BrandLockup } from "@/components/shell/brand-mark";
import { LEGAL_LINKS } from "@/lib/legal";

/**
 * The page around a sign-in, sign-up or password form: a focused task, so no navigation. The logo
 * (top left, the way home), one narrow column (24rem) and the legal links, reachable signed out.
 * No box around the form: on a page with one thing on it, the space is the grouping.
 */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background px-page pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <Link href="/" className="inline-flex min-h-11 w-fit items-center rounded-md" aria-label="SHIFTY home">
          <BrandLockup />
        </Link>
        <main className="pt-8 pb-12 md:pt-16">{children}</main>
        <nav aria-label="Legal" className="mt-auto flex flex-wrap gap-x-4 text-caption text-muted-foreground">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center rounded-sm hover:text-foreground hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
