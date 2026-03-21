import type { Dictionary } from "@/lib/i18n/dictionaries";

export function SiteFooter({ dictionary }: { dictionary: Dictionary }) {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>{dictionary.footer.note}</p>
        <p>{dictionary.common.appTagline}</p>
      </div>
    </footer>
  );
}
