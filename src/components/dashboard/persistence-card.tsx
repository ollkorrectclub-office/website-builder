import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { PersistenceSummary } from "@/lib/workspaces/types";

export function PersistenceCard({
  dictionary,
  persistence,
}: {
  dictionary: Dictionary;
  persistence: PersistenceSummary;
}) {
  const title =
    persistence.mode === "supabase"
      ? dictionary.persistence.supabaseTitle
      : dictionary.persistence.localTitle;
  const copy =
    persistence.mode === "supabase"
      ? dictionary.persistence.supabaseCopy
      : dictionary.persistence.localCopy;

  return (
    <Card className="px-5 py-5">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {dictionary.dashboard.storageMode}
      </p>
      <h3 className="mt-3 font-display text-xl font-bold text-card-foreground">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{copy}</p>
    </Card>
  );
}
