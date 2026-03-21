import type {
  CodeFileEditPolicy,
  CodeFileKind,
  CodeFileLanguage,
  CodeFileLinkRole,
  CodeFileLinkTargetType,
  CodeFileOwnership,
  CreateCodeScaffoldInput,
  GeneratedCodeScaffold,
  ProjectCodeFileLinkRecord,
  ProjectCodeFileRevisionRecord,
  ProjectCodeFileRecord,
  VisualSectionType,
} from "@/lib/builder/types";

const sectionComponentPaths: Record<VisualSectionType, string> = {
  navbar: "components/site/site-navbar.tsx",
  hero: "components/sections/hero-section.tsx",
  features: "components/sections/features-section.tsx",
  testimonials: "components/sections/testimonials-section.tsx",
  pricing: "components/sections/pricing-section.tsx",
  faq: "components/sections/faq-section.tsx",
  contact: "components/sections/contact-section.tsx",
  footer: "components/site/site-footer.tsx",
  custom_generic: "components/sections/content-block.tsx",
};

interface CodeFileLinkDescriptor {
  targetType: CodeFileLinkTargetType;
  role: CodeFileLinkRole;
  visualPageId?: string | null;
  visualSectionId?: string | null;
  targetLabel: string;
}

function nowIso() {
  return new Date().toISOString();
}

function extensionForPath(filePath: string) {
  const parts = filePath.split(".");

  return parts.length > 1 ? parts.at(-1) ?? "ts" : "ts";
}

function languageForExtension(extension: string): CodeFileLanguage {
  switch (extension) {
    case "tsx":
      return "tsx";
    case "css":
      return "css";
    case "json":
      return "json";
    default:
      return "ts";
  }
}

function routeFilePathForPage(slug: string, index: number) {
  if (index === 0 || slug === "home") {
    return "app/[locale]/page.tsx";
  }

  return `app/[locale]/${slug}/page.tsx`;
}

function normalizeDirectory(filePath: string) {
  const segments = filePath.split("/");

  if (segments.length === 1) {
    return ".";
  }

  return segments.slice(0, -1).join("/");
}

function pageKeyReference(pageKey: string) {
  return /^[a-zA-Z_$][\w$]*$/.test(pageKey) ? `projectPages.${pageKey}` : `projectPages["${pageKey}"]`;
}

function pageComponentName(title: string, index: number) {
  const safe = title.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const base = safe.length > 0 ? safe : `Page ${index + 1}`;
  const name = base
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  return `${name}Page`;
}

function serialize(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function buildProjectContentFile(input: CreateCodeScaffoldInput) {
  const { visualBundle } = input;
  const projectPages = visualBundle.visualPages
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((page) => ({
      pageKey: page.pageKey,
      title: page.title,
      slug: page.slug,
      sections: visualBundle.visualSections
        .filter((section) => section.pageId === page.id)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((section) => ({
          key: section.sectionKey,
          type: section.sectionType,
          label: section.label,
          title: section.title,
          isVisible: section.isVisible,
          eyebrow: section.contentPayload.eyebrow ?? null,
          body: section.contentPayload.body ?? "",
          items: section.contentPayload.items ?? [],
          ctaLabel: section.contentPayload.ctaLabel ?? null,
        })),
    }));

  const pagesByKey = Object.fromEntries(
    projectPages.map((page) => [
      page.pageKey,
      {
        title: page.title,
        slug: page.slug,
        sections: page.sections,
      },
    ]),
  );

  const projectMeta = {
    projectName: visualBundle.project.name,
    summary: visualBundle.project.structuredPlan.productSummary,
    primaryLocale: visualBundle.project.primaryLocale,
    supportedLocales: visualBundle.project.supportedLocales,
    projectType: visualBundle.project.projectType,
    businessCategory: visualBundle.project.businessCategory,
  };

  return `export type ProjectSectionType =
  | "navbar"
  | "hero"
  | "features"
  | "testimonials"
  | "pricing"
  | "faq"
  | "contact"
  | "footer"
  | "custom_generic";

export interface ProjectSectionData {
  key: string;
  type: ProjectSectionType;
  label: string;
  title: string;
  isVisible: boolean;
  eyebrow: string | null;
  body: string;
  items: string[];
  ctaLabel: string | null;
}

export interface ProjectPageData {
  title: string;
  slug: string;
  sections: ProjectSectionData[];
}

export const projectMeta = ${serialize(projectMeta)} as const;

export const projectPages = ${serialize(pagesByKey)} as Record<string, ProjectPageData>;
`;
}

function buildLayoutFile() {
  return `import type { ReactNode } from "react";

import "@/styles/project-theme.css";

export default function LocaleLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--page-background)] text-[var(--page-text)]">
      {children}
    </div>
  );
}
`;
}

function buildPageFile(pageKey: string, title: string, index: number) {
  return `import { RenderSection } from "@/components/sections/render-section";
import { projectPages } from "@/lib/content/project-content";

const pageData = ${pageKeyReference(pageKey)};

export default function ${pageComponentName(title, index)}() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
      {pageData.sections
        .filter((section) => section.isVisible)
        .map((section) => (
          <RenderSection key={section.key} section={section} />
        ))}
    </main>
  );
}
`;
}

function buildSectionRendererFile() {
  return `import { ContentBlock } from "@/components/sections/content-block";
import { ContactSection } from "@/components/sections/contact-section";
import { FaqSection } from "@/components/sections/faq-section";
import { FeaturesSection } from "@/components/sections/features-section";
import { HeroSection } from "@/components/sections/hero-section";
import { PricingSection } from "@/components/sections/pricing-section";
import { TestimonialsSection } from "@/components/sections/testimonials-section";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNavbar } from "@/components/site/site-navbar";
import type { ProjectSectionData } from "@/lib/content/project-content";

export function RenderSection({
  section,
}: {
  section: ProjectSectionData;
}) {
  switch (section.type) {
    case "navbar":
      return <SiteNavbar section={section} />;
    case "hero":
      return <HeroSection section={section} />;
    case "features":
      return <FeaturesSection section={section} />;
    case "testimonials":
      return <TestimonialsSection section={section} />;
    case "pricing":
      return <PricingSection section={section} />;
    case "faq":
      return <FaqSection section={section} />;
    case "contact":
      return <ContactSection section={section} />;
    case "footer":
      return <SiteFooter section={section} />;
    default:
      return <ContentBlock section={section} />;
  }
}
`;
}

function buildNavbarFile() {
  return `import type { ProjectSectionData } from "@/lib/content/project-content";
import { projectPages } from "@/lib/content/project-content";

export function SiteNavbar({
  section,
}: {
  section: ProjectSectionData;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--surface-color)]/95 px-6 py-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
          <p className="mt-1 text-lg font-semibold text-[var(--page-text)]">{section.title}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          {Object.values(projectPages).map((page) => (
            <span key={page.slug} className="rounded-full border border-slate-200 px-3 py-1">
              {page.title}
            </span>
          ))}
        </nav>
      </div>
    </section>
  );
}
`;
}

function buildFooterFile() {
  return `import type { ProjectSectionData } from "@/lib/content/project-content";
import { projectMeta } from "@/lib/content/project-content";

export function SiteFooter({
  section,
}: {
  section: ProjectSectionData;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-[var(--surface-color)] px-6 py-5">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
      <p className="mt-2 text-base font-semibold text-[var(--page-text)]">{projectMeta.projectName}</p>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{section.body}</p>
    </section>
  );
}
`;
}

function buildHeroFile() {
  return `import type { ProjectSectionData } from "@/lib/content/project-content";

export function HeroSection({
  section,
}: {
  section: ProjectSectionData;
}) {
  return (
    <section className="rounded-[36px] bg-[var(--primary-color)] px-8 py-10 text-white shadow-lg shadow-slate-950/10">
      <p className="text-xs uppercase tracking-[0.22em] text-white/70">
        {section.eyebrow ?? section.label}
      </p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight">{section.title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-8 text-white/80">{section.body}</p>
      {section.ctaLabel ? (
        <div className="mt-6 inline-flex rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900">
          {section.ctaLabel}
        </div>
      ) : null}
    </section>
  );
}
`;
}

function buildFeaturesFile() {
  return `import type { ProjectSectionData } from "@/lib/content/project-content";

export function FeaturesSection({
  section,
}: {
  section: ProjectSectionData;
}) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-[var(--surface-color)] px-8 py-8">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
      <h2 className="mt-3 text-2xl font-semibold text-[var(--page-text)]">{section.title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{section.body}</p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {section.items.map((item) => (
          <div key={item} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

function buildTestimonialsFile() {
  return `import type { ProjectSectionData } from "@/lib/content/project-content";

export function TestimonialsSection({
  section,
}: {
  section: ProjectSectionData;
}) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-[var(--surface-color)] px-8 py-8">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
      <h2 className="mt-3 text-2xl font-semibold text-[var(--page-text)]">{section.title}</h2>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {section.items.map((item) => (
          <div key={item} className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
            <p className="text-sm leading-7 text-slate-700">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

function buildPricingFile() {
  return `import type { ProjectSectionData } from "@/lib/content/project-content";

export function PricingSection({
  section,
}: {
  section: ProjectSectionData;
}) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-[var(--surface-color)] px-8 py-8">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
      <h2 className="mt-3 text-2xl font-semibold text-[var(--page-text)]">{section.title}</h2>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {section.items.map((item) => (
          <div key={item} className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
            <p className="text-sm font-semibold text-[var(--page-text)]">{item}</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">{section.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

function buildFaqFile() {
  return `import type { ProjectSectionData } from "@/lib/content/project-content";

export function FaqSection({
  section,
}: {
  section: ProjectSectionData;
}) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-[var(--surface-color)] px-8 py-8">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
      <h2 className="mt-3 text-2xl font-semibold text-[var(--page-text)]">{section.title}</h2>
      <div className="mt-6 space-y-3">
        {section.items.map((item) => (
          <div key={item} className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-sm font-semibold text-[var(--page-text)]">{item}</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">{section.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

function buildContactFile() {
  return `import type { ProjectSectionData } from "@/lib/content/project-content";

export function ContactSection({
  section,
}: {
  section: ProjectSectionData;
}) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-[var(--surface-color)] px-8 py-8">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
      <h2 className="mt-3 text-2xl font-semibold text-[var(--page-text)]">{section.title}</h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">{section.body}</p>
      {section.ctaLabel ? (
        <div className="mt-6 inline-flex rounded-full bg-[var(--secondary-color)] px-5 py-2 text-sm font-semibold text-white">
          {section.ctaLabel}
        </div>
      ) : null}
    </section>
  );
}
`;
}

function buildContentBlockFile() {
  return `import type { ProjectSectionData } from "@/lib/content/project-content";

export function ContentBlock({
  section,
}: {
  section: ProjectSectionData;
}) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-[var(--surface-color)] px-8 py-8">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
      <h2 className="mt-3 text-2xl font-semibold text-[var(--page-text)]">{section.title}</h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">{section.body}</p>
    </section>
  );
}
`;
}

function buildThemeTokensFile(input: CreateCodeScaffoldInput) {
  return `export const tokens = ${serialize(input.visualBundle.visualState.themeTokens)} as const;
`;
}

function buildAuthRolesFile(input: CreateCodeScaffoldInput) {
  const roles = input.visualBundle.project.structuredPlan.authRoles;

  return `export const authRoles = ${serialize(roles)} as const;

export const authEnabled = ${input.visualBundle.project.capabilities.auth};
`;
}

function buildDataModelsFile(input: CreateCodeScaffoldInput) {
  return `export const dataModels = ${serialize(input.visualBundle.project.structuredPlan.dataModels)} as const;
`;
}

function buildIntegrationsFile(input: CreateCodeScaffoldInput) {
  return `export const integrations = ${serialize(input.visualBundle.project.structuredPlan.integrationsNeeded)} as const;

export const capabilityFlags = ${serialize(input.visualBundle.project.capabilities)} as const;
`;
}

function buildStylesFile(input: CreateCodeScaffoldInput) {
  const tokens = input.visualBundle.visualState.themeTokens;

  return `:root {
  --primary-color: ${tokens.primaryColor};
  --secondary-color: ${tokens.secondaryColor};
  --page-background: ${tokens.backgroundColor};
  --surface-color: ${tokens.surfaceColor};
  --page-text: ${tokens.textColor};
  --heading-font-label: "${tokens.headingFontLabel}";
  --radius-scale: ${tokens.radiusScale};
  --spacing-scale: ${tokens.spacingScale};
}

body {
  background: var(--page-background);
  color: var(--page-text);
}
`;
}

function buildNextConfigFile() {
  return `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`;
}

function buildTailwindConfigFile() {
  return `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "var(--primary-color)",
        surface: "var(--surface-color)",
      },
    },
  },
};

export default config;
`;
}

function ownershipForFile(filePath: string, _kind: CodeFileKind): CodeFileOwnership {
  if (
    filePath === "lib/content/project-content.ts" ||
    filePath === "lib/theme/tokens.ts" ||
    filePath === "styles/project-theme.css"
  ) {
    return "visual_owned";
  }

  return "scaffold_owned";
}

function editPolicyForOwnership(ownership: CodeFileOwnership): CodeFileEditPolicy {
  return ownership === "visual_owned" ? "locked" : "single_file_draft";
}

function globalLink(role: CodeFileLinkRole, targetLabel: string): CodeFileLinkDescriptor {
  return {
    targetType: "global",
    role,
    targetLabel,
  };
}

function pageLink(pageId: string, targetLabel: string): CodeFileLinkDescriptor {
  return {
    targetType: "page",
    role: "route_page",
    visualPageId: pageId,
    targetLabel,
  };
}

function sectionLinks(
  input: CreateCodeScaffoldInput,
  type: VisualSectionType,
): CodeFileLinkDescriptor[] {
  return input.visualBundle.visualSections
    .filter((section) => section.sectionType === type)
    .map((section) => ({
      targetType: "section" as const,
      role: "section_component" as const,
      visualPageId: section.pageId,
      visualSectionId: section.id,
      targetLabel: section.label,
    }));
}

function pushFile(
  files: ProjectCodeFileRecord[],
  fileRevisions: ProjectCodeFileRevisionRecord[],
  fileLinks: ProjectCodeFileLinkRecord[],
  input: CreateCodeScaffoldInput,
  codeStateId: string,
  filePath: string,
  kind: CodeFileKind,
  content: string,
  orderIndex: number,
  createdFromVisualPageId: string | null = null,
  createdFromSectionId: string | null = null,
  linkDescriptors: CodeFileLinkDescriptor[] = [],
) {
  const extension = extensionForPath(filePath);
  const timestamp = nowIso();
  const fileId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const ownership = ownershipForFile(filePath, kind);
  const editPolicy = editPolicyForOwnership(ownership);

  files.push({
    id: fileId,
    codeStateId,
    projectId: input.visualBundle.project.id,
    path: filePath,
    directory: normalizeDirectory(filePath),
    name: filePath.split("/").at(-1) ?? filePath,
    extension,
    kind,
    language: languageForExtension(extension),
    orderIndex,
    ownership,
    editPolicy,
    content,
    currentRevisionId: revisionId,
    currentRevisionNumber: 1,
    draftContent: null,
    draftUpdatedAt: null,
    draftBaseRevisionId: null,
    draftBaseRevisionNumber: null,
    createdFromVisualPageId,
    createdFromSectionId,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  fileRevisions.push({
    id: revisionId,
    fileId,
    projectId: input.visualBundle.project.id,
    revisionNumber: 1,
    kind: "scaffold",
    content,
    changeSummary: "Initial scaffold generated from the current plan and visual state.",
    authoredBy: "system",
    baseRevisionId: null,
    baseRevisionNumber: null,
    sourceProposalId: null,
    sourceProposalTitle: null,
    restoreSource: null,
    restoredFromRevisionId: null,
    restoredFromRevisionNumber: null,
    createdAt: timestamp,
  });

  fileLinks.push(
    ...linkDescriptors.map((descriptor) => ({
      id: crypto.randomUUID(),
      fileId,
      projectId: input.visualBundle.project.id,
      visualStateId: input.visualBundle.visualState.id,
      targetType: descriptor.targetType,
      role: descriptor.role,
      visualPageId: descriptor.visualPageId ?? null,
      visualSectionId: descriptor.visualSectionId ?? null,
      targetLabel: descriptor.targetLabel,
      createdAt: timestamp,
    })),
  );
}

export function createCodeScaffold(input: CreateCodeScaffoldInput): GeneratedCodeScaffold {
  const timestamp = nowIso();
  const codeStateId = input.existingState?.id ?? crypto.randomUUID();
  const files: ProjectCodeFileRecord[] = [];
  const fileRevisions: ProjectCodeFileRevisionRecord[] = [];
  const fileLinks: ProjectCodeFileLinkRecord[] = [];
  let orderIndex = 0;

  pushFile(
    files,
    fileRevisions,
    fileLinks,
    input,
    codeStateId,
    "app/[locale]/layout.tsx",
    "route",
    buildLayoutFile(),
    orderIndex++,
    null,
    null,
    [globalLink("layout_shell", "Project shell layout")],
  );

  for (const [index, page] of input.visualBundle.visualPages
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .entries()) {
    pushFile(
      files,
      fileRevisions,
      fileLinks,
      input,
      codeStateId,
      routeFilePathForPage(page.slug, index),
      "route",
      buildPageFile(page.pageKey, page.title, index),
      orderIndex++,
      page.id,
      null,
      [pageLink(page.id, page.title)],
    );
  }

  pushFile(
    files,
    fileRevisions,
    fileLinks,
    input,
    codeStateId,
    "components/sections/render-section.tsx",
    "component",
    buildSectionRendererFile(),
    orderIndex++,
    null,
    null,
    [globalLink("section_renderer", "Visual section renderer")],
  );

  const uniqueTypes = Array.from(
    new Set(input.visualBundle.visualSections.map((section) => section.sectionType)),
  );

  for (const type of uniqueTypes) {
    const filePath = sectionComponentPaths[type];
    const links = sectionLinks(input, type);

    if (type === "navbar") {
      pushFile(
        files,
        fileRevisions,
        fileLinks,
        input,
        codeStateId,
        filePath,
        "component",
        buildNavbarFile(),
        orderIndex++,
        null,
        null,
        links,
      );
      continue;
    }

    if (type === "footer") {
      pushFile(
        files,
        fileRevisions,
        fileLinks,
        input,
        codeStateId,
        filePath,
        "component",
        buildFooterFile(),
        orderIndex++,
        null,
        null,
        links,
      );
      continue;
    }

    if (type === "hero") {
      pushFile(
        files,
        fileRevisions,
        fileLinks,
        input,
        codeStateId,
        filePath,
        "component",
        buildHeroFile(),
        orderIndex++,
        null,
        null,
        links,
      );
      continue;
    }

    if (type === "features") {
      pushFile(
        files,
        fileRevisions,
        fileLinks,
        input,
        codeStateId,
        filePath,
        "component",
        buildFeaturesFile(),
        orderIndex++,
        null,
        null,
        links,
      );
      continue;
    }

    if (type === "testimonials") {
      pushFile(
        files,
        fileRevisions,
        fileLinks,
        input,
        codeStateId,
        filePath,
        "component",
        buildTestimonialsFile(),
        orderIndex++,
        null,
        null,
        links,
      );
      continue;
    }

    if (type === "pricing") {
      pushFile(
        files,
        fileRevisions,
        fileLinks,
        input,
        codeStateId,
        filePath,
        "component",
        buildPricingFile(),
        orderIndex++,
        null,
        null,
        links,
      );
      continue;
    }

    if (type === "faq") {
      pushFile(
        files,
        fileRevisions,
        fileLinks,
        input,
        codeStateId,
        filePath,
        "component",
        buildFaqFile(),
        orderIndex++,
        null,
        null,
        links,
      );
      continue;
    }

    if (type === "contact") {
      pushFile(
        files,
        fileRevisions,
        fileLinks,
        input,
        codeStateId,
        filePath,
        "component",
        buildContactFile(),
        orderIndex++,
        null,
        null,
        links,
      );
      continue;
    }

    pushFile(
      files,
      fileRevisions,
      fileLinks,
      input,
      codeStateId,
      filePath,
      "component",
      buildContentBlockFile(),
      orderIndex++,
      null,
      null,
      links,
    );
  }

  pushFile(
    files,
    fileRevisions,
    fileLinks,
    input,
    codeStateId,
    "lib/content/project-content.ts",
    "data",
    buildProjectContentFile(input),
    orderIndex++,
    null,
    null,
    [globalLink("project_content", "Project content registry")],
  );
  pushFile(
    files,
    fileRevisions,
    fileLinks,
    input,
    codeStateId,
    "lib/theme/tokens.ts",
    "style",
    buildThemeTokensFile(input),
    orderIndex++,
    null,
    null,
    [globalLink("theme_tokens", "Theme token source")],
  );
  pushFile(
    files,
    fileRevisions,
    fileLinks,
    input,
    codeStateId,
    "lib/auth/roles.ts",
    "integration",
    buildAuthRolesFile(input),
    orderIndex++,
  );
  pushFile(
    files,
    fileRevisions,
    fileLinks,
    input,
    codeStateId,
    "lib/data/models.ts",
    "data",
    buildDataModelsFile(input),
    orderIndex++,
  );
  pushFile(
    files,
    fileRevisions,
    fileLinks,
    input,
    codeStateId,
    "lib/integrations.ts",
    "integration",
    buildIntegrationsFile(input),
    orderIndex++,
  );
  pushFile(
    files,
    fileRevisions,
    fileLinks,
    input,
    codeStateId,
    "styles/project-theme.css",
    "style",
    buildStylesFile(input),
    orderIndex++,
    null,
    null,
    [globalLink("theme_styles", "Theme styles output")],
  );
  pushFile(
    files,
    fileRevisions,
    fileLinks,
    input,
    codeStateId,
    "next.config.ts",
    "config",
    buildNextConfigFile(),
    orderIndex++,
  );
  pushFile(
    files,
    fileRevisions,
    fileLinks,
    input,
    codeStateId,
    "tailwind.config.ts",
    "config",
    buildTailwindConfigFile(),
    orderIndex++,
  );

  const activeFilePath = input.existingState?.activeFilePath && files.some((file) => file.path === input.existingState?.activeFilePath)
    ? input.existingState.activeFilePath
    : files.find((file) => file.kind === "route")?.path ?? files[0]?.path ?? "";
  const openFilePaths = Array.from(
    new Set(
      [
        activeFilePath,
        "lib/content/project-content.ts",
        "lib/theme/tokens.ts",
      ].filter((filePath) => files.some((file) => file.path === filePath)),
    ),
  );

  return {
    codeState: {
      id: codeStateId,
      projectId: input.visualBundle.project.id,
      activeFilePath,
      openFilePaths,
      scaffoldSourceRevisionNumber: input.visualBundle.visualState.scaffoldSourceRevisionNumber,
      sourceVisualUpdatedAt: input.visualBundle.visualState.updatedAt,
      manualChanges: false,
      lastGeneratedAt: timestamp,
      createdAt: input.existingState?.createdAt ?? timestamp,
      updatedAt: timestamp,
    },
    files,
    fileRevisions,
    fileLinks,
  };
}
