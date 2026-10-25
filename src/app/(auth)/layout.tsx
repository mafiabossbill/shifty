import Link from "next/link";

import { APP_CONFIG } from "@/lib/app-config";
import { LEGAL_LINKS } from "@/lib/legal";

/** Sign-in, sign-up and password pages: a quiet brand header and one form. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-background px-[max(1rem,env(safe-area-inset-left,0px))] pt-[max(2.5rem,env(safe-area-inset-top,0px))] pb-[max(2.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto flex w-full max-w-sm items-center gap-2">
        <span
          className="flex size-6 items-center justify-center rounded-md text-[11px] font-bold text-white"
          style={{ backgroundColor: APP_CONFIG.brandColor }}
          aria-hidden
        >
          {APP_CONFIG.shortName.slice(0, 1)}
        </span>
        <span className="text-[13px] font-semibold">{APP_CONFIG.name}</span>
      </div>
      <main className="mx-auto mt-12 w-full max-w-sm">{children}</main>
      <nav aria-label="Legal" className="mx-auto mt-auto flex w-full max-w-sm flex-wrap gap-x-4 gap-y-2 pt-12 text-[12px] text-muted-foreground">
        {LEGAL_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-foreground">
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
