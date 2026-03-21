import type { NextPageContext } from "next";
import Link from "next/link";

function statusLabel(statusCode: number) {
  if (statusCode === 404) {
    return "Page not found";
  }

  if (statusCode >= 500) {
    return "Server error";
  }

  return "Something went wrong";
}

export default function LegacyErrorPage({ statusCode = 500 }: { statusCode?: number }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="max-w-xl space-y-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          {statusCode}
        </p>
        <h1 className="font-display text-4xl font-bold">{statusLabel(statusCode)}</h1>
        <p className="text-sm leading-7 text-muted-foreground">
          Next.js requested a legacy error boundary for this runtime path. The app shell is still
          available, and you can continue from the workspace hub.
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

LegacyErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 500;

  return { statusCode };
};
