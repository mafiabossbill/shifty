import { cn } from "@/lib/utils";

/**
 * The SHIFTY mark: an ink tile with a lilac goal arc and a warm dot where the shift ends.
 * Same art as the app icon (public/icons). Decorative next to the wordmark.
 */
export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <rect width="32" height="32" rx="9" fill="#14112a" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="3.4" />
      <path d="M16 7.5 A8.5 8.5 0 1 1 7.5 16" fill="none" stroke="#8b7bff" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="7.5" cy="16" r="2.3" fill="#ffae5a" />
    </svg>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="font-display text-[17px] font-semibold tracking-[0.06em]">SHIFTY</span>
    </span>
  );
}
