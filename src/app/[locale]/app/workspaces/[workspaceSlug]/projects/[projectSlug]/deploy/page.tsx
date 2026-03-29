import { notFound } from "next/navigation";

import { ProjectDeployScreen } from "@/components/deploy/project-deploy-screen";
import {
  applyDeployTargetPresetAction,
  createDeploySnapshotAction,
  executeDeployReleaseAction,
  executeDeployReleaseHandoffSimulationAction,
  prepareDeployReleaseHandoffAction,
  promoteDeployReleaseAction,
  recheckDeployExecutionRunAction,
  retryDeployExecutionRunAction,
  saveDeployTargetSettingsAction,
} from "@/lib/deploy/actions";
import { projectDeployExportRoute } from "@/lib/builder/routes";
import { getProjectDeployBundle } from "@/lib/deploy/repository";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectDeployPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; workspaceSlug: string; projectSlug: string }>;
  searchParams: Promise<{
    deployRun?: string;
    artifact?: string;
    file?: string;
    release?: string;
    handoffRun?: string;
    executionRun?: string;
  }>;
}) {
  const { locale, workspaceSlug, projectSlug } = await params;
  const { deployRun, artifact, file, release, handoffRun, executionRun } = await searchParams;
  const dictionary = getDictionary(locale);
  const bundle = await getProjectDeployBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    notFound();
  }

  return (
    <ProjectDeployScreen
      locale={locale as Locale}
      dictionary={dictionary}
      workspaceSlug={workspaceSlug}
      projectSlug={projectSlug}
      bundle={bundle}
      selectedDeployRunId={typeof deployRun === "string" ? deployRun : null}
      selectedArtifactType={typeof artifact === "string" ? artifact : null}
      selectedFilePath={typeof file === "string" ? file : null}
      selectedReleaseId={typeof release === "string" ? release : null}
      selectedHandoffRunId={typeof handoffRun === "string" ? handoffRun : null}
      selectedExecutionRunId={typeof executionRun === "string" ? executionRun : null}
      createDeployAction={createDeploySnapshotAction.bind(null, locale, workspaceSlug, projectSlug)}
      applyDeployTargetPresetAction={applyDeployTargetPresetAction.bind(
        null,
        locale,
        workspaceSlug,
        projectSlug,
      )}
      saveDeployTargetSettingsAction={saveDeployTargetSettingsAction.bind(
        null,
        locale,
        workspaceSlug,
        projectSlug,
      )}
      promoteDeployReleaseAction={promoteDeployReleaseAction.bind(
        null,
        locale,
        workspaceSlug,
        projectSlug,
      )}
      prepareDeployReleaseHandoffAction={prepareDeployReleaseHandoffAction.bind(
        null,
        locale,
        workspaceSlug,
        projectSlug,
      )}
      executeDeployReleaseHandoffSimulationAction={executeDeployReleaseHandoffSimulationAction.bind(
        null,
        locale,
        workspaceSlug,
        projectSlug,
      )}
      executeDeployReleaseAction={executeDeployReleaseAction.bind(
        null,
        locale,
        workspaceSlug,
        projectSlug,
      )}
      recheckDeployExecutionRunAction={recheckDeployExecutionRunAction.bind(
        null,
        locale,
        workspaceSlug,
        projectSlug,
      )}
      retryDeployExecutionRunAction={retryDeployExecutionRunAction.bind(
        null,
        locale,
        workspaceSlug,
        projectSlug,
      )}
      exportAction={projectDeployExportRoute(locale, workspaceSlug, projectSlug)}
    />
  );
}
