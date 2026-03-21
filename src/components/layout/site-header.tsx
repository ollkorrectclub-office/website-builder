import Link from "next/link";

import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { buttonStyles } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

export function SiteHeader({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: Dictionary;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <Logo href={`/${locale}`} label={dictionary.common.appName} />

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground lg:flex">
          <a href="#product" className="transition hover:text-foreground">
            {dictionary.nav.product}
          </a>
          <a href="#workflow" className="transition hover:text-foreground">
            {dictionary.nav.workflow}
          </a>
          <a href="#sectors" className="transition hover:text-foreground">
            {dictionary.nav.sectors}
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher locale={locale} />
          <ThemeToggle
            lightLabel={dictionary.common.themeLight}
            darkLabel={dictionary.common.themeDark}
          />
          <Link href={`/${locale}/login`} className={buttonStyles("ghost")}>
            {dictionary.common.login}
          </Link>
          <Link href={`/${locale}/signup`} className={buttonStyles("secondary")}>
            {dictionary.common.signup}
          </Link>
        </div>
      </div>
    </header>
  );
}
