import type {
  CreateVisualScaffoldInput,
  GeneratedVisualScaffold,
  VisualSectionContentPayload,
  VisualSectionRecord,
  VisualSectionType,
  VisualThemeTokens,
} from "@/lib/builder/types";
import { slugify } from "@/lib/workspaces/utils";

function nowIso() {
  return new Date().toISOString();
}

function uniqueTypes(items: VisualSectionType[]) {
  return Array.from(new Set(items));
}

function preferredSourceRevision(revisions: CreateVisualScaffoldInput["revisions"]) {
  return revisions.find((revision) => revision.state === "approved") ?? revisions[0];
}

function defaultThemeTokens(designStyle: string): VisualThemeTokens {
  switch (designStyle) {
    case "corporate-serious":
      return {
        primaryColor: "#0f172a",
        secondaryColor: "#2563eb",
        backgroundColor: "#f8fafc",
        surfaceColor: "#ffffff",
        textColor: "#0f172a",
        headingFontLabel: "Structured Sans",
        radiusScale: "medium",
        spacingScale: "comfortable",
      };
    case "warm-hospitality":
      return {
        primaryColor: "#7c2d12",
        secondaryColor: "#ea580c",
        backgroundColor: "#fff7ed",
        surfaceColor: "#ffffff",
        textColor: "#431407",
        headingFontLabel: "Warm Editorial",
        radiusScale: "soft",
        spacingScale: "airy",
      };
    default:
      return {
        primaryColor: "#0f172a",
        secondaryColor: "#0f766e",
        backgroundColor: "#f8fafc",
        surfaceColor: "#ffffff",
        textColor: "#111827",
        headingFontLabel: "Premium Grotesk",
        radiusScale: "large",
        spacingScale: "balanced",
      };
  }
}

function pageSlug(title: string, index: number) {
  if (index === 0) {
    return "home";
  }

  return slugify(title) || `page-${index + 1}`;
}

function inferSectionType(value: string): VisualSectionType {
  const normalized = value.toLowerCase();

  if (normalized.includes("price")) return "pricing";
  if (normalized.includes("faq") || normalized.includes("question")) return "faq";
  if (normalized.includes("contact") || normalized.includes("booking")) return "contact";
  if (normalized.includes("testimonial") || normalized.includes("review") || normalized.includes("trust")) return "testimonials";
  if (normalized.includes("feature") || normalized.includes("service")) return "features";

  return "custom_generic";
}

function buildSectionTypesForPage(pageTitle: string, pageIndex: number, featureList: string[]) {
  const keywordTypes = featureList.slice(0, 6).map(inferSectionType);
  const pageType = inferSectionType(pageTitle);
  const types: VisualSectionType[] = ["navbar"];

  if (pageIndex === 0) {
    types.push("hero", "features");
  }

  if (pageType !== "custom_generic") {
    types.push(pageType);
  } else if (pageIndex > 0) {
    types.push("custom_generic");
  }

  if (pageIndex === 0 && keywordTypes.includes("testimonials")) {
    types.push("testimonials");
  }

  if (pageIndex === 0 && (keywordTypes.includes("pricing") || featureList.some((item) => item.toLowerCase().includes("pricing")))) {
    types.push("pricing");
  }

  if (pageIndex === 0 && keywordTypes.includes("faq")) {
    types.push("faq");
  }

  if (keywordTypes.includes("contact") || pageTitle.toLowerCase().includes("contact")) {
    types.push("contact");
  }

  types.push("footer");

  return uniqueTypes(types);
}

function createContentPayload(
  type: VisualSectionType,
  pageTitle: string,
  productSummary: string,
  featureList: string[],
): VisualSectionContentPayload {
  switch (type) {
    case "hero":
      return {
        eyebrow: pageTitle,
        body: productSummary,
        ctaLabel: "Primary CTA",
      };
    case "features":
      return {
        body: `Structured content for ${pageTitle}.`,
        items: featureList.slice(0, 4),
      };
    case "testimonials":
      return {
        body: "Place trust, proof, and review content here.",
        items: ["Verified client proof", "Outcome highlights", "Professional trust block"],
      };
    case "pricing":
      return {
        body: "Price tiers, service packages, or consultation framing.",
        items: ["Starter", "Growth", "Premium"],
      };
    case "faq":
      return {
        body: "Frequently asked questions and objection handling.",
        items: ["Common question", "Implementation timeline", "Support expectations"],
      };
    case "contact":
      return {
        body: "Primary contact or booking CTA area.",
        ctaLabel: "Contact team",
      };
    case "navbar":
      return {
        body: "Primary navigation, locale switch, and header CTA.",
      };
    case "footer":
      return {
        body: "Footer links, contact info, and trust/legal links.",
      };
    case "custom_generic":
      return {
        body: `Structured content block for ${pageTitle}.`,
      };
  }
}

export function createVisualScaffold(input: CreateVisualScaffoldInput): GeneratedVisualScaffold {
  const timestamp = nowIso();
  const sourceRevision =
    (input.preferredRevisionNumber
      ? input.revisions.find((revision) => revision.revisionNumber === input.preferredRevisionNumber) ?? null
      : null) ?? preferredSourceRevision(input.revisions);
  const visualStateId = input.existingState?.id ?? crypto.randomUUID();
  const pages = input.project.structuredPlan.pageMap.length > 0 ? input.project.structuredPlan.pageMap : ["Home"];
  const themeTokens = input.existingTokens ?? defaultThemeTokens(input.project.designStyle);

  const visualPages = pages.map((title, index) => {
    const pageId = crypto.randomUUID();

    return {
      id: pageId,
      visualStateId,
      projectId: input.project.id,
      pageKey: pageSlug(title, index),
      title,
      slug: pageSlug(title, index),
      orderIndex: index,
      contentPayload: {
        pageTitle: title,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });

  const visualSections = visualPages.flatMap((page, pageIndex) => {
    const sectionTypes = buildSectionTypesForPage(
      page.title,
      pageIndex,
      input.project.structuredPlan.featureList,
    );

    return sectionTypes.map((sectionType, sectionIndex) => {
      const title = sectionType === "custom_generic"
        ? `${page.title} content`
        : `${page.title} ${sectionType}`;

      const section: VisualSectionRecord = {
        id: crypto.randomUUID(),
        visualStateId,
        projectId: input.project.id,
        pageId: page.id,
        sectionKey: `${page.pageKey}-${sectionType}-${sectionIndex + 1}`,
        sectionType,
        title,
        label: title,
        orderIndex: sectionIndex,
        isVisible: true,
        contentPayload: createContentPayload(
          sectionType,
          page.title,
          input.project.structuredPlan.productSummary,
          input.project.structuredPlan.featureList,
        ),
        createdFromPlan: page.title,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      return section;
    });
  });

  const activePageId =
    input.existingState?.activePageId && visualPages.some((page) => page.id === input.existingState?.activePageId)
      ? input.existingState.activePageId
      : visualPages[0]?.id ?? "";

  return {
    visualState: {
      id: visualStateId,
      projectId: input.project.id,
      activePageId,
      themeTokens,
      scaffoldSourceRevisionNumber: sourceRevision.revisionNumber,
      manualChanges: false,
      lastScaffoldAt: timestamp,
      createdAt: input.existingState?.createdAt ?? timestamp,
      updatedAt: timestamp,
    },
    visualPages,
    visualSections,
    sourceRevision,
  };
}
