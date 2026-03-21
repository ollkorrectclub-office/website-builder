import { createCodeScaffold } from "@/lib/builder/code-scaffold";
import type {
  GeneratedVisualScaffold,
  ProjectVisualBundle,
  VisualPageRecord,
  VisualSectionContentPayload,
  VisualSectionRecord,
  VisualThemeTokens,
} from "@/lib/builder/types";
import { requestOpenAICompatibleJson, resolveOpenAICompatibleEndpoint, readApiKeyFromEnv } from "@/lib/model-adapters/openai-compatible";
import { ExternalProviderExecutionError } from "@/lib/model-adapters/errors";
import { ExternalAdapterNotReadyError } from "@/lib/model-adapters/registry";
import type { ModelAdapterTraceRecord } from "@/lib/model-adapters/types";
import { DeterministicGenerationAdapter } from "@/lib/generation/deterministic-generator";
import type {
  GenerationAdapter,
  GenerationInput,
  GenerationResult,
  GenerationRunTrigger,
  GenerationRouteTargetRecord,
} from "@/lib/generation/types";
import { slugify } from "@/lib/workspaces/utils";

function countLines(content: string) {
  return content.split("\n").length;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeSectionPayload(
  value: unknown,
  fallback: VisualSectionContentPayload,
): VisualSectionContentPayload {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const eyebrow = normalizeString(record.eyebrow);
  const body = normalizeString(record.body);
  const ctaLabel = normalizeString(record.ctaLabel);
  const items = normalizeItems(record.items);

  return {
    eyebrow: eyebrow || fallback.eyebrow || undefined,
    body: body || fallback.body || "",
    items: items.length > 0 ? items : fallback.items ?? [],
    ctaLabel: ctaLabel || fallback.ctaLabel || undefined,
  };
}

function normalizeThemeTokens(
  value: unknown,
  fallback: VisualThemeTokens,
): VisualThemeTokens {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as Record<string, unknown>;

  return {
    primaryColor: normalizeString(record.primaryColor) || fallback.primaryColor,
    secondaryColor: normalizeString(record.secondaryColor) || fallback.secondaryColor,
    backgroundColor: normalizeString(record.backgroundColor) || fallback.backgroundColor,
    surfaceColor: normalizeString(record.surfaceColor) || fallback.surfaceColor,
    textColor: normalizeString(record.textColor) || fallback.textColor,
    headingFontLabel: normalizeString(record.headingFontLabel) || fallback.headingFontLabel,
    radiusScale: normalizeString(record.radiusScale) || fallback.radiusScale,
    spacingScale: normalizeString(record.spacingScale) || fallback.spacingScale,
  };
}

function buildShadowProject(input: GenerationInput) {
  return {
    ...input.project,
    structuredPlan: input.approvedRevision.plan,
    currentPlanRevisionId: input.approvedRevision.id,
    currentPlanRevisionNumber: input.approvedRevision.revisionNumber,
    plannerSource: input.approvedRevision.plannerSource,
    planLastUpdatedAt: input.approvedRevision.createdAt,
  };
}

function buildGeneratedVisualBundle(
  input: GenerationInput,
  shadowProject: GenerationInput["project"],
  visualTarget: GeneratedVisualScaffold,
): ProjectVisualBundle {
  return {
    workspace: input.workspace,
    project: shadowProject,
    latestRevision: input.revisions[0],
    currentUser: input.currentUser,
    membership: input.membership,
    workspacePermissions: input.workspacePermissions,
    projectPermissions: input.projectPermissions,
    revisions: input.revisions,
    visualState: visualTarget.visualState,
    visualPages: visualTarget.visualPages,
    visualSections: visualTarget.visualSections,
    sourceRevision: input.approvedRevision,
    syncState: {
      sourceRevisionNumber: input.approvedRevision.revisionNumber,
      sourceRevisionState: input.approvedRevision.state,
      latestRevisionNumber: input.revisions[0]?.revisionNumber ?? input.approvedRevision.revisionNumber,
      approvedRevisionNumber: input.approvedRevision.revisionNumber,
      hasManualChanges: false,
      needsRegeneration: false,
    },
  };
}

function buildRouteTargets(
  visualPages: VisualPageRecord[],
  visualSections: VisualSectionRecord[],
  codeFiles: GenerationResult["codeTarget"]["files"],
): GenerationRouteTargetRecord[] {
  return visualPages
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((page) => {
      const routeFile =
        codeFiles.find(
          (file) => file.kind === "route" && file.createdFromVisualPageId === page.id,
        ) ?? null;

      return {
        pageKey: page.pageKey,
        title: page.title,
        slug: page.slug,
        routePath:
          routeFile?.path ??
          `app/[locale]/${page.slug === "home" || page.orderIndex === 0 ? "page" : `${page.slug}/page`}.tsx`,
        sectionCount: visualSections.filter((section) => section.pageId === page.id).length,
      };
    });
}

function generationSummary(
  name: string,
  revisionNumber: number,
  routeCount: number,
  fileCount: number,
) {
  return `Generated ${routeCount} route targets and ${fileCount} scaffold files for ${name} from approved revision ${revisionNumber} via external generation.`;
}

function providerMetadata(config: ExternalCodegenAdapter["config"], notes: string) {
  return {
    sourceAdapter: "external_codegen_adapter_v1",
    providerKey: config.providerKey,
    providerLabel: config.providerLabel,
    modelName: config.modelName,
    notes,
  };
}

function generationSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "themeTokens", "pages", "generationNotes"],
    properties: {
      summary: { type: "string" },
      generationNotes: { type: "string" },
      themeTokens: {
        type: "object",
        additionalProperties: false,
        required: [
          "primaryColor",
          "secondaryColor",
          "backgroundColor",
          "surfaceColor",
          "textColor",
          "headingFontLabel",
          "radiusScale",
          "spacingScale",
        ],
        properties: {
          primaryColor: { type: "string" },
          secondaryColor: { type: "string" },
          backgroundColor: { type: "string" },
          surfaceColor: { type: "string" },
          textColor: { type: "string" },
          headingFontLabel: { type: "string" },
          radiusScale: { type: "string" },
          spacingScale: { type: "string" },
        },
      },
      pages: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["pageKey", "title", "slug", "sections"],
          properties: {
            pageKey: { type: "string" },
            title: { type: "string" },
            slug: { type: "string" },
            sections: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["sectionKey", "title", "label", "isVisible", "content"],
                properties: {
                  sectionKey: { type: "string" },
                  title: { type: "string" },
                  label: { type: "string" },
                  isVisible: { type: "boolean" },
                  content: {
                    type: "object",
                    additionalProperties: false,
                    required: ["eyebrow", "body", "items", "ctaLabel"],
                    properties: {
                      eyebrow: { type: "string" },
                      body: { type: "string" },
                      items: {
                        type: "array",
                        items: { type: "string" },
                      },
                      ctaLabel: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  } as const;
}

function buildGenerationInstructions() {
  return [
    "You are the generation model for a structured website and app builder.",
    "Return JSON only and match the schema exactly.",
    "Stay aligned to the approved plan and the provided scaffold outline.",
    "Do not invent extra pages or extra section keys beyond the outline.",
    "Improve page titles, slugs, theme tokens, and section copy so the output feels launch-ready.",
    "Keep body copy concise, concrete, and product-appropriate.",
    "Do not output code fences, prose, or markdown outside the schema.",
  ].join(" ");
}

function buildGenerationPrompt(input: {
  project: GenerationInput["project"];
  approvedRevision: GenerationInput["approvedRevision"];
  baseline: GenerationResult;
  trigger: GenerationRunTrigger;
}) {
  return [
    `Generation trigger: ${input.trigger}`,
    "Approved plan JSON:",
    JSON.stringify(
      {
        projectName: input.project.name,
        projectType: input.project.projectType,
        productSummary: input.approvedRevision.plan.productSummary,
        targetUsers: input.approvedRevision.plan.targetUsers,
        pageMap: input.approvedRevision.plan.pageMap,
        featureList: input.approvedRevision.plan.featureList,
        designDirection: input.approvedRevision.plan.designDirection,
        businessCategory: input.project.businessCategory,
        primaryLocale: input.project.primaryLocale,
        supportedLocales: input.project.supportedLocales,
      },
      null,
      2,
    ),
    "Baseline scaffold outline JSON:",
    JSON.stringify(
      {
        themeTokens: input.baseline.themeTarget,
        pages: input.baseline.visualTarget.visualPages
          .sort((left, right) => left.orderIndex - right.orderIndex)
          .map((page) => ({
            pageKey: page.pageKey,
            title: page.title,
            slug: page.slug,
            sections: input.baseline.visualTarget.visualSections
              .filter((section) => section.pageId === page.id)
              .sort((left, right) => left.orderIndex - right.orderIndex)
              .map((section) => ({
                sectionKey: section.sectionKey,
                sectionType: section.sectionType,
                title: section.title,
                label: section.label,
                isVisible: section.isVisible,
                content: section.contentPayload,
              })),
          })),
      },
      null,
      2,
    ),
  ].join("\n\n");
}

function mergeExternalOutput(input: {
  base: GenerationResult;
  providerOutput: ExternalGenerationStructuredOutput;
}): {
  visualTarget: GeneratedVisualScaffold;
  providerNotes: string;
} {
  const nextThemeTokens = normalizeThemeTokens(
    input.providerOutput.themeTokens,
    input.base.visualTarget.visualState.themeTokens,
  );
  const pagesByKey = new Map(
    input.providerOutput.pages.map((page) => [normalizeString(page.pageKey), page] as const),
  );

  const usedSlugs = new Set<string>();
  const visualPages = input.base.visualTarget.visualPages.map((page, index) => {
    const providerPage = pagesByKey.get(page.pageKey);
    const nextTitle = normalizeString(providerPage?.title) || page.title;
    const preferredSlug = slugify(normalizeString(providerPage?.slug) || nextTitle);
    const nextSlug =
      preferredSlug.length > 0 &&
      !usedSlugs.has(preferredSlug) &&
      (index !== 0 || preferredSlug === "home")
        ? preferredSlug
        : page.slug;

    usedSlugs.add(nextSlug);

    return {
      ...page,
      title: nextTitle,
      slug: nextSlug,
      contentPayload: {
        ...page.contentPayload,
        pageTitle: nextTitle,
      },
    };
  });

  const visualPageById = new Map(visualPages.map((page) => [page.id, page] as const));
  const visualSections = input.base.visualTarget.visualSections.map((section) => {
    const page = visualPageById.get(section.pageId);
    const providerPage = page ? pagesByKey.get(page.pageKey) : null;
    const providerSection =
      providerPage?.sections.find((candidate) => normalizeString(candidate.sectionKey) === section.sectionKey) ??
      null;

    return {
      ...section,
      title: normalizeString(providerSection?.title) || section.title,
      label: normalizeString(providerSection?.label) || section.label,
      isVisible: normalizeBoolean(providerSection?.isVisible, section.isVisible),
      contentPayload: normalizeSectionPayload(providerSection?.content, section.contentPayload),
    };
  });

  return {
    visualTarget: {
      visualState: {
        ...input.base.visualTarget.visualState,
        themeTokens: nextThemeTokens,
      },
      visualPages,
      visualSections,
      sourceRevision: input.base.visualTarget.sourceRevision,
    },
    providerNotes: normalizeString(input.providerOutput.generationNotes),
  };
}

interface ExternalGenerationStructuredOutput {
  summary: string;
  generationNotes: string;
  themeTokens: VisualThemeTokens;
  pages: Array<{
    pageKey: string;
    title: string;
    slug: string;
    sections: Array<{
      sectionKey: string;
      title: string;
      label: string;
      isVisible: boolean;
      content: {
        eyebrow: string;
        body: string;
        items: string[];
        ctaLabel: string;
      };
    }>;
  }>;
}

export interface ExternalGenerationExecutionDetails {
  latencyMs: number;
  trace: ModelAdapterTraceRecord;
}

export class ExternalCodegenAdapter {
  readonly source = "external_codegen_adapter_v1" as const;
  readonly config: {
    providerKey: "openai_compatible" | "custom_http";
    providerLabel: string;
    modelName: string;
    endpointUrl: string | null;
    apiKeyEnvVar: string;
  };
  private readonly deterministicAdapter: GenerationAdapter;

  constructor(config: {
    providerKey: "openai_compatible" | "custom_http";
    providerLabel: string;
    modelName: string;
    endpointUrl: string | null;
    apiKeyEnvVar: string;
  }) {
    this.config = config;
    this.deterministicAdapter = new DeterministicGenerationAdapter();
  }

  async generate(
    input: GenerationInput,
    trigger: GenerationRunTrigger,
  ): Promise<{ result: GenerationResult; execution: ExternalGenerationExecutionDetails }> {
    if (this.config.providerKey !== "openai_compatible") {
      throw new ExternalAdapterNotReadyError(
        `External generation adapter for ${this.config.providerLabel} is not wired beyond OpenAI-compatible generation yet.`,
      );
    }

    let apiKey: string;

    try {
      apiKey = readApiKeyFromEnv(this.config.apiKeyEnvVar);
    } catch (error) {
      throw new ExternalAdapterNotReadyError(
        error instanceof Error ? error.message : "Generation API key is not configured.",
      );
    }

    const baseline = await this.deterministicAdapter.generate(input, trigger);
    const endpointUrl = resolveOpenAICompatibleEndpoint(this.config.endpointUrl);

    let providerResponse;

    try {
      providerResponse = await requestOpenAICompatibleJson<ExternalGenerationStructuredOutput>({
        endpointUrl,
        apiKey,
        model: this.config.modelName,
        instructions: buildGenerationInstructions(),
        promptInput: buildGenerationPrompt({
          project: input.project,
          approvedRevision: input.approvedRevision,
          baseline,
          trigger,
        }),
        schemaName: "builder_generation_output",
        schema: generationSchema(),
        metadata: {
          capability: "generation",
          trigger,
        },
        traceLabels: {
          instructions: "Generation instructions",
          input: "Generation input",
          output: "Generation output",
          error: "Generation error",
        },
      });
    } catch (error) {
      if (error instanceof ExternalProviderExecutionError) {
        throw error;
      }

      throw new ExternalProviderExecutionError(
        error instanceof Error ? error.message : "External generation request failed.",
      );
    }

    const merged = mergeExternalOutput({
      base: baseline,
      providerOutput: providerResponse.parsed,
    });
    const shadowProject = buildShadowProject(input);
    const visualBundle = buildGeneratedVisualBundle(input, shadowProject, merged.visualTarget);
    const codeTarget = createCodeScaffold({
      visualBundle,
    });
    const routeTargets = buildRouteTargets(
      merged.visualTarget.visualPages,
      merged.visualTarget.visualSections,
      codeTarget.files,
    );
    const outputSummary = {
      visualPageCount: merged.visualTarget.visualPages.length,
      visualSectionCount: merged.visualTarget.visualSections.length,
      routeCount: routeTargets.length,
      codeFileCount: codeTarget.files.length,
      componentFileCount: codeTarget.files.filter((file) => file.kind === "component").length,
      themeTokenCount: Object.keys(merged.visualTarget.visualState.themeTokens).length,
    };
    const notes = merged.providerNotes;
    const metadata = providerMetadata(this.config, notes);

    return {
      result: {
        source: this.source,
        trigger,
        status: "completed",
        summary:
          normalizeString(providerResponse.parsed.summary) ||
          generationSummary(input.project.name, input.approvedRevision.revisionNumber, routeTargets.length, codeTarget.files.length),
        sourcePlanRevisionId: input.approvedRevision.id,
        sourcePlanRevisionNumber: input.approvedRevision.revisionNumber,
        sourcePlanSnapshot: input.approvedRevision.plan,
        outputSummary,
        routeTargets,
        themeTarget: merged.visualTarget.visualState.themeTokens,
        visualTarget: merged.visualTarget,
        codeTarget,
        artifacts: [
          {
            artifactType: "route_page_target",
            label: "Route and page target",
            payload: {
              sourcePlanRevisionNumber: input.approvedRevision.revisionNumber,
              routes: routeTargets,
              metadata,
            },
          },
          {
            artifactType: "theme_token_target",
            label: "Theme token target",
            payload: {
              sourcePlanRevisionNumber: input.approvedRevision.revisionNumber,
              tokens: merged.visualTarget.visualState.themeTokens,
              metadata,
            },
          },
          {
            artifactType: "visual_scaffold_target",
            label: "Visual scaffold target",
            payload: {
              sourcePlanRevisionNumber: input.approvedRevision.revisionNumber,
              activePageId: merged.visualTarget.visualState.activePageId,
              pages: merged.visualTarget.visualPages.map((page) => ({
                id: page.id,
                pageKey: page.pageKey,
                title: page.title,
                slug: page.slug,
                orderIndex: page.orderIndex,
                contentPayload: page.contentPayload,
                sections: merged.visualTarget.visualSections
                  .filter((section) => section.pageId === page.id)
                  .sort((left, right) => left.orderIndex - right.orderIndex)
                  .map((section) => ({
                    id: section.id,
                    pageId: section.pageId,
                    sectionKey: section.sectionKey,
                    sectionType: section.sectionType,
                    title: section.title,
                    label: section.label,
                    orderIndex: section.orderIndex,
                    isVisible: section.isVisible,
                    contentPayload: section.contentPayload,
                    createdFromPlan: section.createdFromPlan,
                  })),
              })),
              metadata,
            },
          },
          {
            artifactType: "code_scaffold_target",
            label: "Code scaffold target",
            payload: {
              sourcePlanRevisionNumber: input.approvedRevision.revisionNumber,
              state: {
                activeFilePath: codeTarget.codeState.activeFilePath,
                openFilePaths: codeTarget.codeState.openFilePaths,
                scaffoldSourceRevisionNumber: codeTarget.codeState.scaffoldSourceRevisionNumber,
              },
              files: codeTarget.files.map((file) => ({
                id: file.id,
                path: file.path,
                directory: file.directory,
                name: file.name,
                extension: file.extension,
                kind: file.kind,
                language: file.language,
                orderIndex: file.orderIndex,
                ownership: file.ownership,
                editPolicy: file.editPolicy,
                createdFromVisualPageId: file.createdFromVisualPageId,
                createdFromSectionId: file.createdFromSectionId,
                lineCount: countLines(file.content),
                content: file.content,
              })),
              fileLinks: codeTarget.fileLinks.map((link) => {
                const file = codeTarget.files.find((entry) => entry.id === link.fileId);

                return {
                  filePath: file?.path ?? "",
                  targetType: link.targetType,
                  role: link.role,
                  visualPageId: link.visualPageId,
                  visualSectionId: link.visualSectionId,
                  targetLabel: link.targetLabel,
                };
              }),
              metadata,
            },
          },
        ],
      },
      execution: {
        latencyMs: providerResponse.latencyMs,
        trace: providerResponse.trace,
      },
    };
  }
}
