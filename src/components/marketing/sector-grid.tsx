import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function SectorGrid({ dictionary }: { dictionary: Dictionary }) {
  return (
    <section id="sectors" className="px-6 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Sectors
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
              {dictionary.landing.sectorsTitle}
            </h2>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {dictionary.landing.sectors.map((sector) => (
            <Card key={sector.name} className="px-5 py-6">
              <h3 className="font-display text-xl font-bold text-card-foreground">{sector.name}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{sector.copy}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
