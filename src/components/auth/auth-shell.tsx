import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

export function AuthShell({
  locale,
  dictionary,
  title,
  copy,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  title: string;
  copy: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="flex flex-col justify-between bg-slate-950 px-7 py-8 text-slate-100 shadow-panel">
          <div className="space-y-6">
            <Logo href={`/${locale}`} label={dictionary.common.appName} />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Foundation access</p>
              <h1 className="mt-3 font-display text-4xl font-bold text-white">{title}</h1>
              <p className="mt-4 text-sm leading-7 text-slate-300">{copy}</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/6 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Current scope</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
              <li>Localized public foundation</li>
              <li>Auth UI with workspace-oriented access flow</li>
              <li>Real workspace and project intake</li>
              <li>Plan review surface with revision tracking</li>
              <li>Code generation not enabled yet</li>
            </ul>
          </div>
        </Card>

        <Card className="flex items-center px-6 py-8 sm:px-10">{children}</Card>
      </div>
    </div>
  );
}
