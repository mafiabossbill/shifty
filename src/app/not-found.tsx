import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-base font-semibold">Page not found</h1>
        <p className="mt-1 text-muted-foreground">The link may be old, or the page was moved.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline">
          Go home
        </Link>
      </div>
    </main>
  );
}
