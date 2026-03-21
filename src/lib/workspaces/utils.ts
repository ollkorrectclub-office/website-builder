import type { PlanRevisionState, ProjectStatus } from "@/lib/workspaces/types";

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

export function formatDateLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function formatDateTimeLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function statusTone(status: ProjectStatus) {
  switch (status) {
    case "plan_approved":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "plan_in_review":
      return "border-primary/40 bg-primary/10 text-primary";
    case "plan_ready":
      return "border-amber-300/50 bg-amber-100/70 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-200";
    case "intake_submitted":
      return "border-sky-300/50 bg-sky-100/70 text-sky-900 dark:border-sky-600/40 dark:bg-sky-950/40 dark:text-sky-200";
    case "archived":
      return "border-border bg-background/80 text-muted-foreground";
    case "draft":
      return "border-slate-300/50 bg-slate-100/80 text-slate-900 dark:border-slate-600/40 dark:bg-slate-900/40 dark:text-slate-200";
  }
}

export function revisionTone(state: PlanRevisionState) {
  switch (state) {
    case "approved":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "needs_changes":
      return "border-rose-300/50 bg-rose-100/70 text-rose-900 dark:border-rose-600/40 dark:bg-rose-950/40 dark:text-rose-200";
    case "draft_saved":
      return "border-sky-300/50 bg-sky-100/70 text-sky-900 dark:border-sky-600/40 dark:bg-sky-950/40 dark:text-sky-200";
    case "generated":
      return "border-primary/40 bg-primary/10 text-primary";
  }
}
