/** The one headline of a focused page (sign-in, reset, onboarding) and the line under it. */
export function AuthHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6 grid gap-1">
      <h1 className="text-heading font-semibold tracking-tight">{title}</h1>
      {children ? <p className="text-muted-foreground">{children}</p> : null}
    </header>
  );
}
