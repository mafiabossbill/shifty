import { cn } from "@/lib/utils";

/**
 * The SHIFTY mark: an ink tile with a violet goal arc and a warm dot where the shift ends.
 * Same art as the app icon (public/icons). Its colours are the logo's own (`logo-*` in globals.css):
 * the one place violet appears outside Mochi. Decorative next to the wordmark.
 */
export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6 shrink-0", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      {/* The hairline keeps the tile's edge on a dark page, where ink on ink would vanish. */}
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" className="fill-logo-ink stroke-logo-ring" />
      <circle cx="16" cy="16" r="8.5" strokeWidth="3.4" className="fill-none stroke-logo-ring" />
      <path d="M16 7.5 A8.5 8.5 0 1 1 7.5 16" strokeWidth="3.4" strokeLinecap="round" className="fill-none stroke-logo-arc" />
      <circle cx="7.5" cy="16" r="2.3" className="fill-logo-dot" />
    </svg>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark />
      <span className="text-title font-semibold">SHIFTY</span>
    </span>
  );
}
