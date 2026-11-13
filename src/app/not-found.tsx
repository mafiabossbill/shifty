import Link from "next/link";

import { AuthHeading } from "@/components/auth/auth-heading";
import { BrandLockup } from "@/components/shell/brand-mark";
import { Button } from "@/components/ui/button";

/** A link that leads nowhere: say so in plain words and offer the way home. */
export default function NotFound() {
  return (
    <div className="min-h-dvh px-page pt-[max(1rem,env(safe-area-inset-top,0px))] pb-12">
      <div className="mx-auto w-full max-w-sm">
        <Link href="/" className="inline-flex min-h-11 w-fit items-center rounded-md" aria-label="SHIFTY home">
          <BrandLockup />
        </Link>
        <main className="pt-8 md:pt-16">
          <AuthHeading title="Page not found">The link may be old, or the page was moved.</AuthHeading>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </main>
      </div>
    </div>
  );
}
