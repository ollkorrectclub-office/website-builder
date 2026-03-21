import { HeroSection } from "@/components/marketing/hero-section";
import { SectorGrid } from "@/components/marketing/sector-grid";
import { WorkflowSection } from "@/components/marketing/workflow-section";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Card } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dictionary = getDictionary(locale);

  return (
    <div className="min-h-screen">
      <SiteHeader locale={locale as Locale} dictionary={dictionary} />
      <main>
        <HeroSection locale={locale as Locale} dictionary={dictionary} />
        <WorkflowSection dictionary={dictionary} />
        <SectorGrid dictionary={dictionary} />

        <section id="product" className="px-6 py-12 sm:py-16">
          <div className="mx-auto grid w-full max-w-7xl gap-5 lg:grid-cols-3">
            <Card className="px-6 py-6 lg:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Public foundation
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold text-card-foreground">
                {dictionary.landing.phaseTitle}
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
                {dictionary.landing.phaseCopy}
              </p>
            </Card>
            <Card className="px-6 py-6">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {dictionary.landing.scopeTitle}
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-card-foreground">
                {dictionary.landing.scopeItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Card>
          </div>
        </section>
      </main>
      <SiteFooter dictionary={dictionary} />
    </div>
  );
}
