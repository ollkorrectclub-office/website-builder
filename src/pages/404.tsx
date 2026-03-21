import Link from "next/link";

export default function LegacyNotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="max-w-xl space-y-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          404
        </p>
        <h1 className="font-display text-4xl font-bold">Page not found</h1>
        <p className="text-sm leading-7 text-muted-foreground">
          The page you requested is not available. Return to the workspace hub to continue.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-90"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
