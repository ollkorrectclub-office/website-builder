"use client";

import { useTheme } from "@/components/providers/theme-provider";

export function ThemeToggle({
  lightLabel,
  darkLabel,
}: {
  lightLabel: string;
  darkLabel: string;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card/80 px-4 text-sm font-semibold text-card-foreground transition hover:-translate-y-0.5 hover:border-primary/40"
      aria-label="Toggle color theme"
    >
      <span className="text-base">{theme === "light" ? "☀" : "☾"}</span>
      <span>{theme === "light" ? lightLabel : darkLabel}</span>
    </button>
  );
}
