import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function WorkflowSection({ dictionary }: { dictionary: Dictionary }) {
  return (
    <section id="workflow" className="px-6 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Workflow
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
            {dictionary.landing.workflowTitle}
          </h2>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {dictionary.landing.workflowSteps.map((step, index) => (
            <Card key={step.title} className="px-6 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">
                0{index + 1}
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-card-foreground">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.copy}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
