import { Card } from "@/components/ui/card";
import type { CodeDiffLine } from "@/lib/builder/code-diff";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function CodeDiffView({
  dictionary,
  title,
  lines,
}: {
  dictionary: Dictionary;
  title: string;
  lines: CodeDiffLine[];
}) {
  return (
    <Card className="overflow-hidden border-border/80">
      <div className="border-b border-border bg-background/60 px-5 py-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {dictionary.builder.code.diffTitle}
        </p>
        <p className="mt-2 text-sm font-semibold text-card-foreground">{title}</p>
      </div>

      <div className="bg-slate-950 px-0 py-4 text-slate-100">
        {lines.map((line, index) => {
          const tone =
            line.kind === "added"
              ? "bg-emerald-500/10 text-emerald-100"
              : line.kind === "removed"
                ? "bg-rose-500/10 text-rose-100"
                : "text-slate-200";

          return (
            <div
              key={`${line.kind}-${index}-${line.leftNumber ?? "x"}-${line.rightNumber ?? "y"}-${line.content}`}
              className={`grid grid-cols-[36px_52px_52px_minmax(0,1fr)] gap-0 px-5 py-0.5 font-mono text-sm ${tone}`}
            >
              <span className="select-none pr-3 text-right text-slate-500">
                {line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " "}
              </span>
              <span className="select-none pr-3 text-right text-slate-500">
                {line.leftNumber ?? ""}
              </span>
              <span className="select-none pr-3 text-right text-slate-500">
                {line.rightNumber ?? ""}
              </span>
              <span className="whitespace-pre">{line.content || " "}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
