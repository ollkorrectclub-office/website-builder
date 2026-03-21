"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import type { BuilderTabItem, BuilderTabKey } from "@/lib/builder/types";
import { cn } from "@/lib/utils";

function normalizeSegment(segment: string | null): BuilderTabKey | null {
  if (segment === "visual" || segment === "code" || segment === "preview") {
    return segment;
  }

  if (segment && segment !== "plan") {
    return null;
  }

  return "plan";
}

export function ProjectBuilderTabs({
  items,
}: {
  items: BuilderTabItem[];
}) {
  const segment = useSelectedLayoutSegment();
  const activeTab = normalizeSegment(segment);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-3">
        {items.map((item) => {
          const active = item.key === activeTab;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "min-w-[180px] rounded-[24px] border px-4 py-3 transition duration-200",
                active
                  ? "border-primary/40 bg-primary/10 text-foreground shadow-soft"
                  : "border-border bg-background/70 text-muted-foreground hover:-translate-y-0.5 hover:border-primary/30 hover:text-card-foreground",
              )}
            >
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="mt-1 text-xs leading-5">{item.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
