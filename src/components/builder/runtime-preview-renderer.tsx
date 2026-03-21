import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VisualSectionRecord, VisualThemeTokens } from "@/lib/builder/types";
import type { RuntimePreviewRouteRecord } from "@/lib/builder/runtime-preview";

function radiusValue(scale: string) {
  switch (scale) {
    case "small":
      return 18;
    case "medium":
      return 24;
    case "soft":
      return 28;
    case "large":
      return 32;
    default:
      return 28;
  }
}

function shellSpacing(scale: string) {
  switch (scale) {
    case "tight":
      return "gap-4 px-5 py-8";
    case "comfortable":
      return "gap-5 px-6 py-9";
    case "airy":
      return "gap-8 px-8 py-12";
    case "balanced":
      return "gap-6 px-6 py-10";
    default:
      return "gap-6 px-6 py-10";
  }
}

function headingClass(fontLabel: string) {
  return /serif/i.test(fontLabel) ? "font-serif" : "font-display";
}

function sectionFrameStyle(tokens: VisualThemeTokens) {
  return {
    borderRadius: `${radiusValue(tokens.radiusScale)}px`,
  };
}

function renderItems(items?: string[]) {
  return (items ?? []).filter((item) => item.trim().length > 0);
}

function RuntimeSection({
  section,
  tokens,
  projectName,
  routes,
  selectedRoute,
}: {
  section: VisualSectionRecord;
  tokens: VisualThemeTokens;
  projectName: string;
  routes: RuntimePreviewRouteRecord[];
  selectedRoute: RuntimePreviewRouteRecord | null;
}) {
  const frameStyle = sectionFrameStyle(tokens);
  const headingFont = headingClass(tokens.headingFontLabel);
  const items = renderItems(section.contentPayload.items);

  switch (section.sectionType) {
    case "navbar":
      return (
        <section
          style={{
            ...frameStyle,
            backgroundColor: `${tokens.surfaceColor}f2`,
            border: "1px solid rgba(148, 163, 184, 0.22)",
          }}
          className="px-6 py-4 shadow-sm backdrop-blur"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                {section.label}
              </p>
              <p className="mt-1 text-lg font-semibold" style={{ color: tokens.textColor }}>
                {section.title || projectName}
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-2">
              {routes.map((route) => {
                const active = selectedRoute?.pageId === route.pageId;
                return (
                  <span
                    key={route.pageId}
                    className={cn(
                      "rounded-full px-3 py-1 text-sm font-medium",
                      active ? "border-transparent text-white" : "border text-slate-600",
                    )}
                    style={{
                      backgroundColor: active ? tokens.primaryColor : tokens.surfaceColor,
                      borderColor: active ? "transparent" : `${tokens.primaryColor}22`,
                    }}
                  >
                    {route.title}
                  </span>
                );
              })}
            </nav>
          </div>
        </section>
      );
    case "hero":
      return (
        <section
          style={{
            ...frameStyle,
            backgroundColor: tokens.primaryColor,
          }}
          className="px-8 py-10 text-white shadow-lg shadow-slate-950/10"
        >
          <p className="text-xs uppercase tracking-[0.22em] text-white/70">
            {section.contentPayload.eyebrow ?? section.label}
          </p>
          <h1 className={cn("mt-4 max-w-3xl text-4xl font-semibold tracking-tight", headingFont)}>
            {section.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-white/80">
            {section.contentPayload.body}
          </p>
          {section.contentPayload.ctaLabel ? (
            <div className="mt-6 inline-flex rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900">
              {section.contentPayload.ctaLabel}
            </div>
          ) : null}
        </section>
      );
    case "features":
      return (
        <section
          style={{
            ...frameStyle,
            backgroundColor: tokens.surfaceColor,
            border: `1px solid ${tokens.primaryColor}18`,
          }}
          className="px-8 py-8"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
          <h2 className={cn("mt-3 text-2xl font-semibold", headingFont)} style={{ color: tokens.textColor }}>
            {section.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            {section.contentPayload.body}
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <div
                key={item}
                className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>
        </section>
      );
    case "testimonials":
      return (
        <section
          style={{
            ...frameStyle,
            backgroundColor: tokens.surfaceColor,
            border: `1px solid ${tokens.primaryColor}18`,
          }}
          className="px-8 py-8"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
          <h2 className={cn("mt-3 text-2xl font-semibold", headingFont)} style={{ color: tokens.textColor }}>
            {section.title}
          </h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={item}
                className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5"
              >
                <p className="text-sm leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </section>
      );
    case "pricing":
      return (
        <section
          style={{
            ...frameStyle,
            backgroundColor: tokens.surfaceColor,
            border: `1px solid ${tokens.primaryColor}18`,
          }}
          className="px-8 py-8"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
          <h2 className={cn("mt-3 text-2xl font-semibold", headingFont)} style={{ color: tokens.textColor }}>
            {section.title}
          </h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={item}
                className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5"
              >
                <p className="text-sm font-semibold" style={{ color: tokens.textColor }}>
                  {item}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {section.contentPayload.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      );
    case "faq":
      return (
        <section
          style={{
            ...frameStyle,
            backgroundColor: tokens.surfaceColor,
            border: `1px solid ${tokens.primaryColor}18`,
          }}
          className="px-8 py-8"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
          <h2 className={cn("mt-3 text-2xl font-semibold", headingFont)} style={{ color: tokens.textColor }}>
            {section.title}
          </h2>
          <div className="mt-6 space-y-3">
            {items.map((item) => (
              <div
                key={item}
                className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4"
              >
                <p className="text-sm font-semibold" style={{ color: tokens.textColor }}>
                  {item}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {section.contentPayload.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      );
    case "contact":
      return (
        <section
          style={{
            ...frameStyle,
            backgroundColor: tokens.surfaceColor,
            border: `1px solid ${tokens.primaryColor}18`,
          }}
          className="px-8 py-8"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
          <h2 className={cn("mt-3 text-2xl font-semibold", headingFont)} style={{ color: tokens.textColor }}>
            {section.title}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
            {section.contentPayload.body}
          </p>
          {section.contentPayload.ctaLabel ? (
            <div
              className="mt-6 inline-flex rounded-full px-5 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: tokens.secondaryColor }}
            >
              {section.contentPayload.ctaLabel}
            </div>
          ) : null}
        </section>
      );
    case "footer":
      return (
        <section
          style={{
            ...frameStyle,
            backgroundColor: tokens.surfaceColor,
            border: `1px solid ${tokens.primaryColor}18`,
          }}
          className="px-6 py-5"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
          <p className="mt-2 text-base font-semibold" style={{ color: tokens.textColor }}>
            {projectName}
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
            {section.contentPayload.body}
          </p>
        </section>
      );
    case "custom_generic":
      return (
        <section
          style={{
            ...frameStyle,
            backgroundColor: tokens.surfaceColor,
            border: `1px solid ${tokens.primaryColor}18`,
          }}
          className="px-8 py-8"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
          <h2 className={cn("mt-3 text-2xl font-semibold", headingFont)} style={{ color: tokens.textColor }}>
            {section.title}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
            {section.contentPayload.body}
          </p>
        </section>
      );
  }
}

export function RuntimePreviewRenderer({
  projectName,
  selectedRoute,
  routes,
  sections,
  tokens,
  badgeLabel,
  emptyTitle,
  emptyCopy,
  frameClassName,
}: {
  projectName: string;
  selectedRoute: RuntimePreviewRouteRecord | null;
  routes: RuntimePreviewRouteRecord[];
  sections: VisualSectionRecord[];
  tokens: VisualThemeTokens;
  badgeLabel: string;
  emptyTitle: string;
  emptyCopy: string;
  frameClassName?: string;
}) {
  return (
    <div className="overflow-hidden rounded-[32px] border border-border bg-card shadow-soft">
      <div className="border-b border-border/70 bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-rose-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
          <div className="min-w-0 flex-1 rounded-full border border-border bg-background/80 px-4 py-2 text-sm text-muted-foreground">
            {selectedRoute?.browserPath ?? "/"}
          </div>
          <Badge>{badgeLabel}</Badge>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {routes.map((route) => {
            const active = selectedRoute?.pageId === route.pageId;
            return (
              <div
                key={route.pageId}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.14em]",
                  active ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background/70 text-muted-foreground",
                )}
              >
                {route.title}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="border-t border-white/30"
        style={{
          backgroundColor: tokens.backgroundColor,
          color: tokens.textColor,
        }}
      >
        <main className={cn("mx-auto flex min-h-[720px] w-full max-w-6xl flex-col", shellSpacing(tokens.spacingScale), frameClassName)}>
          {sections.length > 0 ? (
            sections.map((section) => (
              <RuntimeSection
                key={section.id}
                section={section}
                tokens={tokens}
                projectName={projectName}
                routes={routes}
                selectedRoute={selectedRoute}
              />
            ))
          ) : (
            <section
              className="px-8 py-10"
              style={{
                ...sectionFrameStyle(tokens),
                backgroundColor: tokens.surfaceColor,
                border: `1px dashed ${tokens.primaryColor}44`,
              }}
            >
              <p className={cn("text-2xl font-bold", headingClass(tokens.headingFontLabel))}>
                {emptyTitle}
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{emptyCopy}</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
