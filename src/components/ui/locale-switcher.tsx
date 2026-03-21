"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { swapLocaleInPath, type Locale } from "@/lib/i18n/locales";

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const resolvedPathname = pathname ?? `/${locale}`;

  return (
    <div className="flex items-center gap-2">
      {(["sq", "en"] as const).map((item) => {
        const active = item === locale;

        return (
          <Link key={item} href={swapLocaleInPath(resolvedPathname, item)} aria-current={active ? "page" : undefined}>
            <Badge className={active ? "border-primary/60 bg-primary/10 text-foreground" : ""}>
              {item.toUpperCase()}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}
