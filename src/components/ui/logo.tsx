import Link from "next/link";

import { cn } from "@/lib/utils";

export function Logo({
  href,
  compact = false,
  label,
}: {
  href: string;
  compact?: boolean;
  label: string;
}) {
  return (
    <Link href={href} className="inline-flex items-center gap-3">
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-sm font-bold text-primary-foreground shadow-soft",
          compact ? "h-10 w-10" : "h-12 w-12",
        )}
      >
        B
      </span>
      <span className="hidden sm:block">
        <span className="block font-display text-lg font-bold leading-none text-foreground">
          {label}
        </span>
        <span className="mt-1 block text-xs uppercase tracking-[0.18em] text-muted-foreground">
          AI product studio
        </span>
      </span>
    </Link>
  );
}
