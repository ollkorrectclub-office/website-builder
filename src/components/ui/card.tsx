import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-border bg-card/90 text-card-foreground shadow-soft backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}
