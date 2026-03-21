import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

export function HeroSection({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: Dictionary;
}) {
  return (
    <section className="relative overflow-hidden px-6 pb-12 pt-12 sm:pt-20">
      <div className="absolute inset-0 -z-10 bg-surface-grid bg-[length:36px_36px] opacity-30" />
      <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[minmax(0,1.2fr)_420px]">
        <div className="space-y-8">
          <Badge>{dictionary.landing.eyebrow}</Badge>
          <div className="space-y-5">
            <h1 className="max-w-4xl font-display text-5xl font-bold leading-[1.02] tracking-tight text-foreground sm:text-6xl">
              {dictionary.landing.title}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              {dictionary.landing.description}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={`/${locale}/app/onboarding`} className={buttonStyles("primary")}>
              {dictionary.landing.primaryCta}
            </Link>
            <a href="#workflow" className={buttonStyles("secondary")}>
              {dictionary.landing.secondaryCta}
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {dictionary.landing.highlights.map((item) => (
              <Card key={item} className="px-5 py-4">
                <p className="text-sm font-semibold text-card-foreground">{item}</p>
              </Card>
            ))}
          </div>
        </div>

        <Card className="relative overflow-hidden bg-slate-950 px-6 py-6 text-white shadow-panel">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary/40 via-accent/30 to-transparent blur-3xl" />
          <div className="relative space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Workspace demo
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold text-white">
                  Kosovo + Albania foundation
                </h2>
              </div>
              <Badge className="border-white/10 bg-white/10 text-white/80">Phase 1</Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {dictionary.landing.stats.map((item) => (
                <div key={item.label} className="rounded-3xl border border-white/10 bg-white/6 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                  <p className="mt-3 text-lg font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/6 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                {dictionary.landing.trustTitle}
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
                {dictionary.landing.trustItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
