import type {
  ProjectCodeBundle,
  ProjectCodeFileRecord,
  ProjectVisualBundle,
  VisualPageRecord,
  VisualSectionRecord,
  VisualThemeTokens,
} from "@/lib/builder/types";
import { buildProjectGenerationTargetBundle } from "@/lib/generation/targets";
import type {
  ProjectGenerationBundle,
  ProjectGenerationTargetBundle,
  GenerationRunRecord,
} from "@/lib/generation/types";
import { findLatestCompletedGenerationRun } from "@/lib/generation/runs";
import type { Locale } from "@/lib/i18n/locales";

export type RuntimePreviewSource = "accepted_generation_target" | "visual_fallback";
export type RuntimePreviewThemeSource = "generation_target" | "visual_state";

export interface RuntimePreviewRouteRecord {
  pageId: string;
  pageKey: string;
  title: string;
  slug: string;
  browserPath: string;
  sourceFilePath: string | null;
  sectionCount: number;
  source: RuntimePreviewSource;
}

export interface RuntimePreviewShellFileRecord {
  label: "layout" | "route" | "content" | "themeTokens" | "themeStyles";
  path: string | null;
  revisionNumber: number | null;
}

export interface RuntimePreviewBundle {
  source: RuntimePreviewSource;
  themeSource: RuntimePreviewThemeSource;
  generationRun: GenerationRunRecord | null;
  generationTarget: ProjectGenerationTargetBundle | null;
  routes: RuntimePreviewRouteRecord[];
  selectedRoute: RuntimePreviewRouteRecord | null;
  selectedPage: VisualPageRecord | null;
  visibleSections: VisualSectionRecord[];
  hiddenSectionCount: number;
  themeTokens: VisualThemeTokens;
  layoutFile: RuntimePreviewShellFileRecord;
  routeFile: RuntimePreviewShellFileRecord;
  contentFile: RuntimePreviewShellFileRecord;
  themeTokensFile: RuntimePreviewShellFileRecord;
  themeStylesFile: RuntimePreviewShellFileRecord;
  visualPinnedRevisionNumber: number;
  codePinnedRevisionNumber: number | null;
  codeMatchesRuntimeRevision: boolean;
}

function routeBrowserPath(locale: Locale, slug: string, index: number) {
  if (index === 0 || slug === "home") {
    return `/${locale}`;
  }

  return `/${locale}/${slug}`;
}

function defaultRouteFilePath(slug: string, index: number) {
  if (index === 0 || slug === "home") {
    return "app/[locale]/page.tsx";
  }

  return `app/[locale]/${slug}/page.tsx`;
}

function routeFileForPage(
  codeBundle: ProjectCodeBundle | null,
  pageId: string,
  fallbackPath: string | null = null,
) {
  if (!codeBundle) {
    return null;
  }

  return (
    codeBundle.files.find((file) => file.kind === "route" && file.createdFromVisualPageId === pageId) ??
    (fallbackPath ? codeBundle.files.find((file) => file.path === fallbackPath) ?? null : null)
  );
}

function shellFile(
  codeBundle: ProjectCodeBundle | null,
  path: string,
): RuntimePreviewShellFileRecord {
  const file = codeBundle?.files.find((entry) => entry.path === path) ?? null;

  return {
    label:
      path === "app/[locale]/layout.tsx"
        ? "layout"
        : path === "lib/content/project-content.ts"
          ? "content"
          : path === "lib/theme/tokens.ts"
            ? "themeTokens"
            : path === "styles/project-theme.css"
              ? "themeStyles"
              : "route",
    path: file?.path ?? path,
    revisionNumber: file?.currentRevisionNumber ?? null,
  };
}

function buildAcceptedGenerationTarget(
  visualBundle: ProjectVisualBundle,
  generationBundle: ProjectGenerationBundle | null,
) {
  if (!generationBundle) {
    return {
      run: null,
      target: null,
    };
  }

  const run = findLatestCompletedGenerationRun(
    generationBundle.runs,
    visualBundle.syncState.sourceRevisionNumber,
  );

  if (!run) {
    return {
      run: null,
      target: null,
    };
  }

  return {
    run,
    target: buildProjectGenerationTargetBundle({
      run,
      artifacts: generationBundle.artifacts.filter((artifact) => artifact.generationRunId === run.id),
    }),
  };
}

function matchingGeneratedPage(
  target: ProjectGenerationTargetBundle | null,
  page: VisualPageRecord,
) {
  if (!target) {
    return null;
  }

  return (
    target.visualPages.find((entry) => entry.id === page.id) ??
    target.visualPages.find((entry) => entry.pageKey === page.pageKey) ??
    target.visualPages.find((entry) => entry.slug === page.slug) ??
    null
  );
}

function themesMatch(left: VisualThemeTokens, right: VisualThemeTokens) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function matchRouteQuery(route: RuntimePreviewRouteRecord, value: string) {
  return (
    route.browserPath === value ||
    route.sourceFilePath === value ||
    route.slug === value ||
    route.pageKey === value
  );
}

export function buildRuntimePreviewBundle(input: {
  locale: Locale;
  visualBundle: ProjectVisualBundle;
  codeBundle: ProjectCodeBundle | null;
  generationBundle: ProjectGenerationBundle | null;
  routeQuery?: string | null;
  pageQuery?: string | null;
}): RuntimePreviewBundle {
  const { locale, visualBundle, codeBundle, generationBundle } = input;
  const { run, target } = buildAcceptedGenerationTarget(visualBundle, generationBundle);
  const visualPages = [...visualBundle.visualPages].sort((left, right) => left.orderIndex - right.orderIndex);
  const routes = visualPages.map<RuntimePreviewRouteRecord>((page, index) => {
    const generatedPage = matchingGeneratedPage(target, page);
    const currentRouteFile = routeFileForPage(
      codeBundle,
      page.id,
      generatedPage ? target?.routeTargets.find((entry) => entry.pageKey === generatedPage.pageKey)?.routePath ?? null : null,
    );
    const slug = generatedPage?.slug ?? page.slug;

    return {
      pageId: page.id,
      pageKey: generatedPage?.pageKey ?? page.pageKey,
      title: generatedPage?.title ?? page.title,
      slug,
      browserPath: routeBrowserPath(locale, slug, index),
      sourceFilePath:
        currentRouteFile?.path ??
        target?.routeTargets.find((entry) => entry.pageKey === (generatedPage?.pageKey ?? page.pageKey))?.routePath ??
        defaultRouteFilePath(slug, index),
      sectionCount:
        target?.routeTargets.find((entry) => entry.pageKey === (generatedPage?.pageKey ?? page.pageKey))?.sectionCount ??
        visualBundle.visualSections.filter((section) => section.pageId === page.id).length,
      source: generatedPage ? "accepted_generation_target" : "visual_fallback",
    };
  });
  const selectedRoute =
    (input.routeQuery
      ? routes.find((route) => matchRouteQuery(route, input.routeQuery ?? ""))
      : null) ??
    (input.pageQuery ? routes.find((route) => route.pageId === input.pageQuery) : null) ??
    routes.find((route) => route.pageId === visualBundle.visualState.activePageId) ??
    routes[0] ??
    null;
  const selectedPage =
    (selectedRoute
      ? visualPages.find((page) => page.id === selectedRoute.pageId)
      : null) ??
    visualPages[0] ??
    null;
  const pageSections = selectedPage
    ? visualBundle.visualSections
        .filter((section) => section.pageId === selectedPage.id)
        .sort((left, right) => left.orderIndex - right.orderIndex)
    : [];
  const visibleSections = pageSections.filter((section) => section.isVisible);
  const generatedRouteFile = selectedRoute?.sourceFilePath ?? null;
  const selectedRouteFile = selectedPage
    ? routeFileForPage(codeBundle, selectedPage.id, generatedRouteFile)
    : null;
  const themeTokens = visualBundle.visualState.themeTokens;
  const themeSource =
    target && themesMatch(themeTokens, target.themeTarget) ? "generation_target" : "visual_state";

  return {
    source: target ? "accepted_generation_target" : "visual_fallback",
    themeSource,
    generationRun: run,
    generationTarget: target,
    routes,
    selectedRoute,
    selectedPage,
    visibleSections,
    hiddenSectionCount: pageSections.length - visibleSections.length,
    themeTokens,
    layoutFile: shellFile(codeBundle, "app/[locale]/layout.tsx"),
    routeFile: {
      label: "route",
      path: selectedRouteFile?.path ?? generatedRouteFile,
      revisionNumber: selectedRouteFile?.currentRevisionNumber ?? null,
    },
    contentFile: shellFile(codeBundle, "lib/content/project-content.ts"),
    themeTokensFile: shellFile(codeBundle, "lib/theme/tokens.ts"),
    themeStylesFile: shellFile(codeBundle, "styles/project-theme.css"),
    visualPinnedRevisionNumber: visualBundle.visualState.scaffoldSourceRevisionNumber,
    codePinnedRevisionNumber: codeBundle?.codeState.scaffoldSourceRevisionNumber ?? null,
    codeMatchesRuntimeRevision:
      codeBundle?.codeState.scaffoldSourceRevisionNumber ===
      visualBundle.visualState.scaffoldSourceRevisionNumber,
  };
}
