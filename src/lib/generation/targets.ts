import type { VisualThemeTokens } from "@/lib/builder/types";
import type {
  GenerationArtifactRecord,
  GenerationCodeFileLinkTargetRecord,
  GenerationCodeFileTargetRecord,
  GenerationCodeStateTargetRecord,
  GenerationRouteTargetRecord,
  GenerationRunRecord,
  GenerationVisualPageTargetRecord,
  GenerationVisualSectionTargetRecord,
  ProjectGenerationTargetBundle,
} from "@/lib/generation/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeDirectory(filePath: string) {
  const segments = filePath.split("/");

  if (segments.length <= 1) {
    return ".";
  }

  return segments.slice(0, -1).join("/");
}

function normalizeName(filePath: string) {
  const segments = filePath.split("/");

  return segments.at(-1) ?? filePath;
}

function normalizeExtension(filePath: string) {
  const name = normalizeName(filePath);
  const parts = name.split(".");

  return parts.length > 1 ? parts.at(-1) ?? "ts" : "ts";
}

function artifactByType(
  artifacts: GenerationArtifactRecord[],
  artifactType: GenerationArtifactRecord["artifactType"],
) {
  return artifacts.find((artifact) => artifact.artifactType === artifactType) ?? null;
}

function readRouteTargets(payload: Record<string, unknown>): GenerationRouteTargetRecord[] {
  const routes = payload.routes;

  if (!Array.isArray(routes)) {
    return [];
  }

  return routes
    .filter(isRecord)
    .map((item) => ({
      pageKey: readString(item.pageKey),
      title: readString(item.title),
      slug: readString(item.slug),
      routePath: readString(item.routePath),
      sectionCount: readNumber(item.sectionCount),
    }))
    .filter((item) => item.pageKey.length > 0 && item.routePath.length > 0);
}

function readThemeTarget(payload: Record<string, unknown>): VisualThemeTokens {
  const tokens = isRecord(payload.tokens) ? payload.tokens : {};

  return {
    primaryColor: readString(tokens.primaryColor, "#0f172a"),
    secondaryColor: readString(tokens.secondaryColor, "#0f766e"),
    backgroundColor: readString(tokens.backgroundColor, "#f8fafc"),
    surfaceColor: readString(tokens.surfaceColor, "#ffffff"),
    textColor: readString(tokens.textColor, "#111827"),
    headingFontLabel: readString(tokens.headingFontLabel, "Premium Grotesk"),
    radiusScale: readString(tokens.radiusScale, "large"),
    spacingScale: readString(tokens.spacingScale, "balanced"),
  };
}

function readVisualPagesAndSections(payload: Record<string, unknown>) {
  const pages = Array.isArray(payload.pages) ? payload.pages.filter(isRecord) : [];
  const visualPages: GenerationVisualPageTargetRecord[] = [];
  const visualSections: GenerationVisualSectionTargetRecord[] = [];

  for (const page of pages) {
    const pageId = readString(page.id);

    if (!pageId) {
      continue;
    }

    visualPages.push({
      id: pageId,
      pageKey: readString(page.pageKey),
      title: readString(page.title),
      slug: readString(page.slug),
      orderIndex: readNumber(page.orderIndex),
      contentPayload: isRecord(page.contentPayload) ? page.contentPayload : {},
    });

    const sections = Array.isArray(page.sections) ? page.sections.filter(isRecord) : [];

    for (const section of sections) {
      const sectionId = readString(section.id);

      if (!sectionId) {
        continue;
      }

      visualSections.push({
        id: sectionId,
        pageId,
        sectionKey: readString(section.sectionKey),
        sectionType: readString(section.sectionType, "custom_generic") as GenerationVisualSectionTargetRecord["sectionType"],
        title: readString(section.title),
        label: readString(section.label),
        orderIndex: readNumber(section.orderIndex),
        isVisible: typeof section.isVisible === "boolean" ? section.isVisible : true,
        contentPayload: isRecord(section.contentPayload) ? section.contentPayload : {},
        createdFromPlan:
          typeof section.createdFromPlan === "string" ? section.createdFromPlan : null,
      });
    }
  }

  return {
    visualPages,
    visualSections,
  };
}

function readCodeState(payload: Record<string, unknown>, run: GenerationRunRecord): GenerationCodeStateTargetRecord {
  const state = isRecord(payload.state) ? payload.state : {};

  return {
    activeFilePath: readString(state.activeFilePath),
    openFilePaths: Array.isArray(state.openFilePaths)
      ? state.openFilePaths.map((item) => readString(item)).filter(Boolean)
      : [],
    scaffoldSourceRevisionNumber: readNumber(
      state.scaffoldSourceRevisionNumber,
      run.sourcePlanRevisionNumber,
    ),
  };
}

function readCodeFiles(payload: Record<string, unknown>): GenerationCodeFileTargetRecord[] {
  const files = Array.isArray(payload.files) ? payload.files.filter(isRecord) : [];

  return files
    .map((file, index) => {
      const path = readString(file.path);
      const name = readString(file.name, normalizeName(path));
      const extension = readString(file.extension, normalizeExtension(path));

      return {
        id: readString(file.id, `generated-file-${path || index}`),
        path,
        directory: readString(file.directory, normalizeDirectory(path)),
        name,
        extension,
        kind: readString(file.kind, "component") as GenerationCodeFileTargetRecord["kind"],
        language: readString(file.language, extension === "tsx" ? "tsx" : "ts") as GenerationCodeFileTargetRecord["language"],
        orderIndex: readNumber(file.orderIndex, index),
        ownership: readString(file.ownership, "scaffold_owned") as GenerationCodeFileTargetRecord["ownership"],
        editPolicy: readString(file.editPolicy, "single_file_draft") as GenerationCodeFileTargetRecord["editPolicy"],
        createdFromVisualPageId:
          typeof file.createdFromVisualPageId === "string" ? file.createdFromVisualPageId : null,
        createdFromSectionId:
          typeof file.createdFromSectionId === "string" ? file.createdFromSectionId : null,
        lineCount: readNumber(file.lineCount, readString(file.content).split("\n").length),
        content: readString(file.content),
      };
    })
    .filter((file) => file.path.length > 0);
}

function readCodeFileLinks(payload: Record<string, unknown>): GenerationCodeFileLinkTargetRecord[] {
  const links = Array.isArray(payload.fileLinks) ? payload.fileLinks.filter(isRecord) : [];

  return links
    .map((link) => ({
      filePath: readString(link.filePath),
      targetType: readString(link.targetType, "global") as GenerationCodeFileLinkTargetRecord["targetType"],
      role: readString(link.role, "project_content") as GenerationCodeFileLinkTargetRecord["role"],
      visualPageId: typeof link.visualPageId === "string" ? link.visualPageId : null,
      visualSectionId: typeof link.visualSectionId === "string" ? link.visualSectionId : null,
      targetLabel: readString(link.targetLabel),
    }))
    .filter((link) => link.filePath.length > 0);
}

export function buildProjectGenerationTargetBundle(input: {
  run: GenerationRunRecord;
  artifacts: GenerationArtifactRecord[];
}): ProjectGenerationTargetBundle | null {
  const routeArtifact = artifactByType(input.artifacts, "route_page_target");
  const themeArtifact = artifactByType(input.artifacts, "theme_token_target");
  const visualArtifact = artifactByType(input.artifacts, "visual_scaffold_target");
  const codeArtifact = artifactByType(input.artifacts, "code_scaffold_target");

  if (!routeArtifact || !themeArtifact || !visualArtifact || !codeArtifact) {
    return null;
  }

  const { visualPages, visualSections } = readVisualPagesAndSections(visualArtifact.payload);
  const codeFiles = readCodeFiles(codeArtifact.payload);
  const codeFileLinks = readCodeFileLinks(codeArtifact.payload);

  if (visualPages.length === 0 || codeFiles.length === 0) {
    return null;
  }

  return {
    run: input.run,
    artifacts: input.artifacts,
    routeTargets: readRouteTargets(routeArtifact.payload),
    themeTarget: readThemeTarget(themeArtifact.payload),
    visualPages,
    visualSections,
    codeState: readCodeState(codeArtifact.payload, input.run),
    codeFiles,
    codeFileLinks,
  };
}
