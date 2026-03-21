import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  VisualPageRecord,
  VisualSectionRecord,
  VisualThemeTokens,
} from "@/lib/builder/types";

function radiusValue(scale: string) {
  switch (scale) {
    case "small":
      return 12;
    case "medium":
      return 18;
    case "soft":
      return 22;
    case "large":
      return 28;
    default:
      return 24;
  }
}

function spacingValue(scale: string) {
  switch (scale) {
    case "tight":
      return 16;
    case "comfortable":
      return 24;
    case "airy":
      return 32;
    case "balanced":
      return 28;
    default:
      return 24;
  }
}

function renderItems(items?: string[]) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {items.map((item) => (
        <div
          key={item}
          className="rounded-[18px] border border-black/10 bg-white/70 px-4 py-4 text-sm leading-6 text-slate-900"
        >
          {item}
        </div>
      ))}
    </div>
  );
}

function renderSectionCard(
  section: VisualSectionRecord,
  tokens: VisualThemeTokens,
  selected: boolean,
) {
  const baseStyle = {
    borderRadius: `${radiusValue(tokens.radiusScale)}px`,
    padding: `${spacingValue(tokens.spacingScale)}px`,
  };

  switch (section.sectionType) {
    case "navbar":
      return (
        <div
          className={selected ? "ring-2 ring-offset-2 ring-offset-transparent" : undefined}
          style={{
            ...baseStyle,
            backgroundColor: tokens.surfaceColor,
            color: tokens.textColor,
            border: `1px solid ${selected ? tokens.primaryColor : `${tokens.primaryColor}22`}`,
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="font-semibold">{section.label}</span>
            <div className="flex gap-3 text-sm opacity-75">
              <span>Home</span>
              <span>Services</span>
              <span>Contact</span>
            </div>
          </div>
        </div>
      );
    case "hero":
      return (
        <div
          className={selected ? "ring-2 ring-offset-2 ring-offset-transparent" : undefined}
          style={{
            ...baseStyle,
            backgroundColor: tokens.primaryColor,
            color: "#ffffff",
            border: `1px solid ${selected ? tokens.secondaryColor : `${tokens.secondaryColor}55`}`,
          }}
        >
          <p className="text-xs uppercase tracking-[0.18em] opacity-70">
            {section.contentPayload.eyebrow || section.label}
          </p>
          <h3 className="mt-3 font-display text-3xl font-bold">{section.title}</h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 opacity-90">
            {section.contentPayload.body}
          </p>
        </div>
      );
    case "features":
    case "pricing":
    case "faq":
    case "testimonials":
      return (
        <div
          className={selected ? "ring-2 ring-offset-2 ring-offset-transparent" : undefined}
          style={{
            ...baseStyle,
            backgroundColor: tokens.surfaceColor,
            color: tokens.textColor,
            border: `1px solid ${selected ? tokens.primaryColor : `${tokens.primaryColor}22`}`,
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-display text-2xl font-bold">{section.title}</h3>
            <Badge>{section.sectionType}</Badge>
          </div>
          <p className="mt-3 text-sm leading-7">{section.contentPayload.body}</p>
          {renderItems(section.contentPayload.items)}
        </div>
      );
    case "contact":
      return (
        <div
          className={selected ? "ring-2 ring-offset-2 ring-offset-transparent" : undefined}
          style={{
            ...baseStyle,
            backgroundColor: tokens.secondaryColor,
            color: "#ffffff",
            border: `1px solid ${selected ? tokens.primaryColor : `${tokens.primaryColor}44`}`,
          }}
        >
          <h3 className="font-display text-2xl font-bold">{section.title}</h3>
          <p className="mt-3 text-sm leading-7 opacity-90">{section.contentPayload.body}</p>
          <div className="mt-4 inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
            {section.contentPayload.ctaLabel || "Contact"}
          </div>
        </div>
      );
    case "footer":
      return (
        <div
          className={selected ? "ring-2 ring-offset-2 ring-offset-transparent" : undefined}
          style={{
            ...baseStyle,
            backgroundColor: "#0f172a",
            color: "#e2e8f0",
            border: `1px solid ${selected ? tokens.secondaryColor : "rgba(255,255,255,0.08)"}`,
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="font-semibold">{section.title}</span>
            <span className="text-sm opacity-70">Legal • Contact • Social</span>
          </div>
        </div>
      );
    case "custom_generic":
      return (
        <div
          className={selected ? "ring-2 ring-offset-2 ring-offset-transparent" : undefined}
          style={{
            ...baseStyle,
            backgroundColor: tokens.surfaceColor,
            color: tokens.textColor,
            border: `1px dashed ${selected ? tokens.primaryColor : `${tokens.primaryColor}55`}`,
          }}
        >
          <h3 className="font-display text-2xl font-bold">{section.title}</h3>
          <p className="mt-3 text-sm leading-7">{section.contentPayload.body}</p>
        </div>
      );
  }
}

export function VisualPageRenderer({
  page,
  sections,
  tokens,
  selectedSectionId,
  sectionHref,
  frameClassName,
  shellClassName,
  badgeLabel,
  emptyTitle,
  emptyCopy,
}: {
  page: VisualPageRecord;
  sections: VisualSectionRecord[];
  tokens: VisualThemeTokens;
  selectedSectionId?: string | null;
  sectionHref?: (sectionId: string) => string;
  frameClassName?: string;
  shellClassName?: string;
  badgeLabel: string;
  emptyTitle: string;
  emptyCopy: string;
}) {
  return (
    <div
      className={cn("rounded-[32px] border border-border p-4", shellClassName)}
      style={{
        backgroundColor: tokens.backgroundColor,
        color: tokens.textColor,
      }}
    >
      <div className="rounded-[24px] border border-border/70 bg-card px-4 py-3 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-rose-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-card-foreground">{page.title}</p>
          <Badge>{badgeLabel}</Badge>
        </div>
      </div>

      <div className={cn("mt-4 space-y-4", frameClassName)}>
        {sections.length > 0 ? (
          sections.map((section) => {
            const content = renderSectionCard(section, tokens, section.id === selectedSectionId);

            if (!sectionHref) {
              return <div key={section.id}>{content}</div>;
            }

            return (
              <Link
                key={section.id}
                href={sectionHref(section.id)}
                className="block transition hover:-translate-y-0.5"
              >
                {content}
              </Link>
            );
          })
        ) : (
          <div
            className="rounded-[28px] border border-dashed px-6 py-8"
            style={{
              borderColor: `${tokens.primaryColor}33`,
              backgroundColor: tokens.surfaceColor,
            }}
          >
            <p className="font-display text-2xl font-bold" style={{ color: tokens.textColor }}>
              {emptyTitle}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: `${tokens.textColor}cc` }}>
              {emptyCopy}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
