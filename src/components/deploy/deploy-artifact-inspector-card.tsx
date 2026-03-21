"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { projectDeployRoute } from "@/lib/builder/routes";
import {
  deployArtifactByType,
  fileKindSummary,
  readDeployOutputFiles,
  readDeployRoutes,
  readDeploySnapshotManifest,
  readDeployThemeCss,
  readDeployThemeVariables,
} from "@/lib/deploy/artifacts";
import { deployArtifactTypeLabel } from "@/lib/deploy/labels";
import type { DeployArtifactRecord, DeployOutputFileRecord, DeployRunRecord, ProjectDeployBundle } from "@/lib/deploy/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

function buildArtifactHref(input: {
  locale: Locale;
  workspaceSlug: string;
  projectSlug: string;
  deployRunId: string;
  artifactType: string;
  filePath?: string | null;
}) {
  const params = new URLSearchParams();
  params.set("deployRun", input.deployRunId);
  params.set("artifact", input.artifactType);

  if (input.filePath) {
    params.set("file", input.filePath);
  }

  return `${projectDeployRoute(input.locale, input.workspaceSlug, input.projectSlug)}?${params.toString()}#deploy-run-${input.deployRunId}`;
}

export function DeployArtifactInspectorCard({
  locale,
  dictionary,
  workspaceSlug,
  projectSlug,
  bundle,
  selectedRun,
  selectedArtifactType,
  selectedFilePath,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspaceSlug: string;
  projectSlug: string;
  bundle: ProjectDeployBundle;
  selectedRun: DeployRunRecord | null;
  selectedArtifactType: string | null;
  selectedFilePath: string | null;
}) {
  const selectedArtifacts = selectedRun
    ? bundle.artifacts.filter((artifact) => artifact.deployRunId === selectedRun.id)
    : [];
  const defaultArtifact =
    deployArtifactByType(selectedArtifacts, "deploy_snapshot_manifest") ?? selectedArtifacts[0] ?? null;
  const selectedArtifact =
    selectedArtifacts.find((artifact) => artifact.artifactType === selectedArtifactType) ?? defaultArtifact;
  const routeArtifact = deployArtifactByType(selectedArtifacts, "deploy_route_bundle");
  const themeArtifact = deployArtifactByType(selectedArtifacts, "deploy_theme_bundle");
  const packageArtifact = deployArtifactByType(selectedArtifacts, "deploy_output_package");
  const snapshotManifest = selectedArtifact?.artifactType === "deploy_snapshot_manifest"
    ? readDeploySnapshotManifest(selectedArtifact.payload)
    : null;
  const routeRecords = selectedArtifact?.artifactType === "deploy_route_bundle" ? readDeployRoutes(selectedArtifact.payload) : [];
  const themeVariables =
    selectedArtifact?.artifactType === "deploy_theme_bundle" ? readDeployThemeVariables(selectedArtifact.payload) : [];
  const themeCss = selectedArtifact?.artifactType === "deploy_theme_bundle" ? readDeployThemeCss(selectedArtifact.payload) : "";
  const packageFiles =
    selectedArtifact?.artifactType === "deploy_output_package" ? readDeployOutputFiles(selectedArtifact.payload) : [];
  const selectedPackageFile =
    packageFiles.find((file) => file.path === selectedFilePath) ?? packageFiles[0] ?? null;
  const artifactOptions = [
    {
      type: "deploy_snapshot_manifest" as const,
      artifact: deployArtifactByType(selectedArtifacts, "deploy_snapshot_manifest"),
    },
    {
      type: "deploy_route_bundle" as const,
      artifact: routeArtifact,
    },
    {
      type: "deploy_theme_bundle" as const,
      artifact: themeArtifact,
    },
    {
      type: "deploy_output_package" as const,
      artifact: packageArtifact,
    },
  ].filter((entry) => entry.artifact);

  if (!selectedRun) {
    return (
      <Card className="px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {dictionary.builder.deploy.artifactInspectorTitle}
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {dictionary.builder.deploy.emptyCopy}
        </p>
      </Card>
    );
  }

  return (
    <Card id={`deploy-run-${selectedRun.id}`} className="px-5 py-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {dictionary.builder.deploy.artifactInspectorTitle}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {dictionary.builder.deploy.artifactInspectorCopy}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {artifactOptions.map(({ type }) => {
          const active = selectedArtifact?.artifactType === type;

          return (
            <Link
              key={type}
              href={buildArtifactHref({
                locale,
                workspaceSlug,
                projectSlug,
                deployRunId: selectedRun.id,
                artifactType: type,
              })}
              className={active ? buttonStyles("primary") : buttonStyles("secondary")}
            >
              {deployArtifactTypeLabel(dictionary, type)}
            </Link>
          );
        })}
      </div>

      {selectedArtifact ? (
        <div className="mt-6 space-y-5">
          <div className="rounded-[22px] border border-border bg-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-card-foreground">{selectedArtifact.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {deployArtifactTypeLabel(dictionary, selectedArtifact.artifactType)}
                </p>
              </div>
              <Badge>{selectedRun.summary}</Badge>
            </div>
          </div>

          {selectedArtifact.artifactType === "deploy_snapshot_manifest" && snapshotManifest ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[22px] border border-border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.builder.deploy.acceptedPlan}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {dictionary.plan.revisionPrefix} {snapshotManifest.approvedPlanRevisionNumber}
                </p>
              </div>
              <div className="rounded-[22px] border border-border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.builder.deploy.acceptedVisual}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {dictionary.plan.revisionPrefix} {snapshotManifest.visualRevisionNumber}
                </p>
              </div>
              <div className="rounded-[22px] border border-border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.builder.deploy.acceptedCode}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {dictionary.plan.revisionPrefix} {snapshotManifest.codeRevisionNumber}
                </p>
              </div>
              <div className="rounded-[22px] border border-border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.builder.deploy.runtimeSource}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {snapshotManifest.runtimeSource}
                </p>
              </div>
            </div>
          ) : null}

          {selectedArtifact.artifactType === "deploy_route_bundle" ? (
            <div className="grid gap-4">
              {routeRecords.map((route) => (
                <div key={route.pageId} className="rounded-[22px] border border-border bg-background/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">{route.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{route.browserPath}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{route.visibleSectionCount}/{route.sectionCount} {dictionary.builder.deploy.visibleSections}</p>
                      <p>{route.routeFilePath ?? dictionary.builder.deploy.notAvailable}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {route.sections.map((section) => (
                      <div key={section.id} className="rounded-[18px] border border-border bg-card/70 p-3">
                        <p className="text-sm font-semibold text-card-foreground">{section.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{section.sectionType}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {section.isVisible
                            ? dictionary.builder.deploy.visibleLabel
                            : dictionary.builder.deploy.hiddenLabel}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {selectedArtifact.artifactType === "deploy_theme_bundle" ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-[22px] border border-border bg-background/70 p-4">
                <p className="text-sm font-semibold text-card-foreground">
                  {dictionary.builder.deploy.themeTokenTitle}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {themeVariables.map((variable) => (
                    <div key={variable.cssVariable} className="rounded-[18px] border border-border bg-card/70 p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {variable.tokenKey}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-card-foreground">{variable.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{variable.cssVariable}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[22px] border border-border bg-background/70 p-4">
                <p className="text-sm font-semibold text-card-foreground">
                  {dictionary.builder.deploy.themeCssTitle}
                </p>
                <pre className="mt-4 overflow-x-auto rounded-[18px] border border-border bg-card/80 p-4 text-xs leading-6 text-card-foreground">
                  {themeCss}
                </pre>
              </div>
            </div>
          ) : null}

          {selectedArtifact.artifactType === "deploy_output_package" ? (
            <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="rounded-[22px] border border-border bg-background/70 p-4">
                <p className="text-sm font-semibold text-card-foreground">
                  {dictionary.builder.deploy.outputPackageTitle}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {fileKindSummary(packageFiles).map(([kind, count]) => (
                    <Badge key={kind}>{kind}: {count}</Badge>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {packageFiles.map((file) => {
                    const active = selectedPackageFile?.path === file.path;
                    const href = buildArtifactHref({
                      locale,
                      workspaceSlug,
                      projectSlug,
                      deployRunId: selectedRun.id,
                      artifactType: "deploy_output_package",
                      filePath: file.path,
                    });

                    return (
                      <Link
                        key={file.path}
                        href={href}
                        className={`block rounded-[18px] border px-3 py-3 transition ${
                          active
                            ? "border-primary/40 bg-primary/10"
                            : "border-border bg-card/70 hover:border-primary/30 hover:bg-card/90"
                        }`}
                      >
                        <p className="text-sm font-semibold text-card-foreground">{file.path}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {file.language.toUpperCase()} · {file.bytes} bytes
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-[22px] border border-border bg-background/70 p-4">
                <p className="text-sm font-semibold text-card-foreground">
                  {selectedPackageFile ? selectedPackageFile.path : dictionary.builder.deploy.noArtifactSelected}
                </p>
                {selectedPackageFile ? (
                  <FilePreview file={selectedPackageFile} />
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {dictionary.builder.deploy.noArtifactSelected}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">{dictionary.builder.deploy.noArtifactSelected}</p>
      )}
    </Card>
  );
}

function FilePreview({ file }: { file: DeployOutputFileRecord }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge>{file.kind}</Badge>
        <Badge>{file.ownership}</Badge>
        <Badge>
          Rev {file.revisionNumber}
        </Badge>
      </div>
      <pre className="overflow-x-auto rounded-[18px] border border-border bg-card/80 p-4 text-xs leading-6 text-card-foreground">
        {file.content}
      </pre>
    </div>
  );
}
