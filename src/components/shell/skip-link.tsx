/** First stop for the keyboard: jump over the navigation to the page (`<main id="main">`). Shown only when focused. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-[60] rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-[calc(0.75rem+env(safe-area-inset-top,0px))] focus:left-3"
    >
      Skip to content
    </a>
  );
}
