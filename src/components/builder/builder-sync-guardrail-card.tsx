import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface GuardrailMetric {
  label: string;
  value: string | number;
}

export function BuilderSyncGuardrailCard({
  title,
  copy,
  metrics,
  tone = "warning",
  toneLabel,
  actions,
}: {
  title: string;
  copy: string;
  metrics: GuardrailMetric[];
  tone?: "warning" | "current";
  toneLabel: string;
  actions?: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "px-6 py-6",
        tone === "warning"
          ? "border-amber-300/50 bg-amber-50/70 dark:border-amber-700/40 dark:bg-amber-950/20"
          : "border-emerald-300/50 bg-emerald-50/70 dark:border-emerald-700/40 dark:bg-emerald-950/20",
      )}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-card-foreground">{title}</p>
            <Badge>{toneLabel}</Badge>
          </div>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{copy}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-[22px] border border-border bg-background/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">{metric.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
