import { PlanBuilderImpactCard } from "@/components/plan/plan-builder-impact-card";
import { PlanCandidatePromotionCard } from "@/components/plan/plan-candidate-promotion-card";
import { PlanEditableCard } from "@/components/plan/plan-editable-card";
import { PlanGenerationCompareCard } from "@/components/plan/plan-generation-compare-card";
import { PlanArtifactInspectorCard } from "@/components/plan/plan-artifact-inspector-card";
import { PlanBriefEditorCard } from "@/components/plan/plan-brief-editor-card";
import { PlanGenerationPipelineCard } from "@/components/plan/plan-generation-pipeline-card";
import { PlanGenerationTraceCard } from "@/components/plan/plan-generation-trace-card";
import { PlanModelAdapterCard } from "@/components/plan/plan-model-adapter-card";
import { PlanPlannerCompareCard } from "@/components/plan/plan-planner-compare-card";
import { PlanPlannerRunsCard } from "@/components/plan/plan-planner-runs-card";
import { PlanPlannerTraceCard } from "@/components/plan/plan-planner-trace-card";
import { PlanReviewActions } from "@/components/plan/plan-review-actions";
import { PlanRunDeltaCard } from "@/components/plan/plan-run-delta-card";
import { ModelAdapterRunHistoryCard } from "@/components/model-adapters/model-adapter-run-history-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { projectTabRoute } from "@/lib/builder/routes";
import type { ProjectGenerationBundle } from "@/lib/generation/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import {
  findGenerationComparison,
  findPlannerComparison,
} from "@/lib/model-adapters/comparisons";
import type { ProjectModelAdapterBundle } from "@/lib/model-adapters/types";
import { plannerSourceLabel } from "@/lib/planner/labels";
import type { ProjectPlannerBundle } from "@/lib/planner/types";
import { serializeDataModels } from "@/lib/planner/plan-sections";
import type { ProjectPlanPromotionBundle } from "@/lib/builder/types";
import { revisionStateLabels, statusLabels } from "@/lib/workspaces/options";
import type { FormState } from "@/lib/workspaces/form-state";
import type {
  PlanRevisionRecord,
  ProjectPermissionsRecord,
  ProjectBriefRecord,
  ProjectRecord,
  WorkspaceRecord,
} from "@/lib/workspaces/types";
import { formatDateTimeLabel, revisionTone, statusTone } from "@/lib/workspaces/utils";

type SectionAction = (state: FormState, formData: FormData) => Promise<FormState>;
type ReviewAction = (state: FormState, formData: FormData) => Promise<FormState>;

export function PlanReviewScreen({
  locale,
  dictionary,
  workspace,
  project,
  projectPermissions,
  brief,
  revisions,
  plannerBundle,
  generationBundle,
  modelAdapterBundle,
  promotionBundle,
  selectedPlannerRunId,
  selectedPlannerComparisonRunId,
  selectedGenerationRunId,
  selectedGenerationComparisonRunId,
  embedded = false,
  sectionActions,
  saveBriefAction,
  saveModelAdapterConfigAction,
  verifyProviderAction,
  rerunPlannerAction,
  rerunGenerationAction,
  queueGenerationAction,
  approveAction,
  needsChangesAction,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspace: WorkspaceRecord;
  project: ProjectRecord;
  projectPermissions: ProjectPermissionsRecord;
  brief: ProjectBriefRecord;
  revisions: PlanRevisionRecord[];
  plannerBundle: ProjectPlannerBundle;
  generationBundle: ProjectGenerationBundle;
  modelAdapterBundle: ProjectModelAdapterBundle;
  promotionBundle: ProjectPlanPromotionBundle;
  selectedPlannerRunId: string | null;
  selectedPlannerComparisonRunId: string | null;
  selectedGenerationRunId: string | null;
  selectedGenerationComparisonRunId: string | null;
  embedded?: boolean;
  sectionActions: Record<string, SectionAction>;
  saveBriefAction: ReviewAction;
  saveModelAdapterConfigAction: ReviewAction;
  verifyProviderAction: ReviewAction;
  rerunPlannerAction: ReviewAction;
  rerunGenerationAction: ReviewAction;
  queueGenerationAction: ReviewAction;
  approveAction: ReviewAction;
  needsChangesAction: ReviewAction;
}) {
  const latestRevision = revisions[0];
  const selectedRun =
    plannerBundle.runs.find((run) => run.id === selectedPlannerRunId) ??
    plannerBundle.latestRun ??
    plannerBundle.runs[0] ??
    null;
  const selectedArtifacts = selectedRun
    ? plannerBundle.artifacts.filter((artifact) => artifact.plannerRunId === selectedRun.id)
    : [];
  const selectedGenerationRun =
    generationBundle.runs.find((run) => run.id === selectedGenerationRunId) ??
    generationBundle.latestRun ??
    generationBundle.runs[0] ??
    null;
  const plannerComparison = findPlannerComparison({
    selectedRun,
    explicitComparisonRunId: selectedPlannerComparisonRunId,
    runs: plannerBundle.runs,
    adapterRuns: modelAdapterBundle.runs,
  });
  const generationComparison = findGenerationComparison({
    selectedRun: selectedGenerationRun,
    explicitComparisonRunId: selectedGenerationComparisonRunId,
    runs: generationBundle.runs,
    adapterRuns: modelAdapterBundle.runs,
  });
  const operatorPermissionCopy = dictionary.plan.operatorPermissionCopy;
  const approvalPermissionCopy = dictionary.plan.approvalPermissionCopy;
  const planHrefBase = projectTabRoute(locale, workspace.slug, project.slug, "plan");
  const codeHrefBase = projectTabRoute(locale, workspace.slug, project.slug, "code");

  return (
    <div className="space-y-6">
      <Card className="px-6 py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {embedded ? dictionary.builder.tabs.plan.label : workspace.name}
            </p>
            <h1 className={embedded
              ? "mt-3 font-display text-3xl font-bold text-card-foreground"
              : "mt-3 font-display text-4xl font-bold text-card-foreground"}
            >
              {embedded ? dictionary.builder.planTitle : dictionary.plan.title}
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">{dictionary.plan.copy}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Badge className={statusTone(project.status)}>{statusLabels[project.status][locale]}</Badge>
            <Badge className={revisionTone(latestRevision.state)}>
              {revisionStateLabels[latestRevision.state][locale]}
            </Badge>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.currentRevision}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">
              {dictionary.plan.revisionPrefix} {project.currentPlanRevisionNumber}
            </p>
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.lastUpdated}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">
              {formatDateTimeLabel(project.planLastUpdatedAt, locale)}
            </p>
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.plannerSource}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">
              {plannerSourceLabel(dictionary, project.plannerSource)}
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        {dictionary.plan.sectionOrder.map((item) => (
          <a
            key={item.key}
            href={`#${item.key}`}
            className="rounded-full border border-border bg-card/80 px-4 py-2 text-sm font-semibold text-card-foreground transition hover:-translate-y-0.5 hover:border-primary/40"
          >
            {item.label}
          </a>
        ))}
      </div>

      <PlanBriefEditorCard
        locale={locale}
        dictionary={dictionary}
        brief={brief}
        currentPlanRevisionNumber={project.currentPlanRevisionNumber}
        action={saveBriefAction}
        readOnly={!projectPermissions.canEditBrief}
        readOnlyCopy={operatorPermissionCopy}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_360px]">
        <div className="space-y-6">
          <PlanEditableCard
            id="productSummary"
            title={dictionary.plan.sections.productSummary.title}
            description={dictionary.plan.sections.productSummary.description}
            action={sectionActions.productSummary}
            inputName="productSummary"
            inputLabel={dictionary.plan.sections.productSummary.inputLabel}
            helperText={dictionary.plan.sections.productSummary.helper}
            defaultValue={project.structuredPlan.productSummary}
            displayKind="text"
            displayText={project.structuredPlan.productSummary}
            changeSummary={dictionary.plan.sections.productSummary.changeSummary}
            editLabel={dictionary.plan.editSection}
            cancelLabel={dictionary.common.cancel}
            saveLabel={dictionary.plan.saveDraft}
            savingLabel={dictionary.plan.saving}
            readOnly={!projectPermissions.canSavePlanDraft}
            readOnlyCopy={operatorPermissionCopy}
          />

          <PlanEditableCard
            id="targetUsers"
            title={dictionary.plan.sections.targetUsers.title}
            description={dictionary.plan.sections.targetUsers.description}
            action={sectionActions.targetUsers}
            inputName="targetUsers"
            inputLabel={dictionary.plan.sections.targetUsers.inputLabel}
            helperText={dictionary.plan.sections.targetUsers.helper}
            defaultValue={project.structuredPlan.targetUsers.join("\n")}
            displayKind="list"
            displayItems={project.structuredPlan.targetUsers}
            changeSummary={dictionary.plan.sections.targetUsers.changeSummary}
            editLabel={dictionary.plan.editSection}
            cancelLabel={dictionary.common.cancel}
            saveLabel={dictionary.plan.saveDraft}
            savingLabel={dictionary.plan.saving}
            readOnly={!projectPermissions.canSavePlanDraft}
            readOnlyCopy={operatorPermissionCopy}
          />

          <PlanEditableCard
            id="pageMap"
            title={dictionary.plan.sections.pageMap.title}
            description={dictionary.plan.sections.pageMap.description}
            action={sectionActions.pageMap}
            inputName="pageMap"
            inputLabel={dictionary.plan.sections.pageMap.inputLabel}
            helperText={dictionary.plan.sections.pageMap.helper}
            defaultValue={project.structuredPlan.pageMap.join("\n")}
            displayKind="list"
            displayItems={project.structuredPlan.pageMap}
            changeSummary={dictionary.plan.sections.pageMap.changeSummary}
            editLabel={dictionary.plan.editSection}
            cancelLabel={dictionary.common.cancel}
            saveLabel={dictionary.plan.saveDraft}
            savingLabel={dictionary.plan.saving}
            readOnly={!projectPermissions.canSavePlanDraft}
            readOnlyCopy={operatorPermissionCopy}
          />

          <PlanEditableCard
            id="featureList"
            title={dictionary.plan.sections.featureList.title}
            description={dictionary.plan.sections.featureList.description}
            action={sectionActions.featureList}
            inputName="featureList"
            inputLabel={dictionary.plan.sections.featureList.inputLabel}
            helperText={dictionary.plan.sections.featureList.helper}
            defaultValue={project.structuredPlan.featureList.join("\n")}
            displayKind="list"
            displayItems={project.structuredPlan.featureList}
            changeSummary={dictionary.plan.sections.featureList.changeSummary}
            editLabel={dictionary.plan.editSection}
            cancelLabel={dictionary.common.cancel}
            saveLabel={dictionary.plan.saveDraft}
            savingLabel={dictionary.plan.saving}
            readOnly={!projectPermissions.canSavePlanDraft}
            readOnlyCopy={operatorPermissionCopy}
          />

          <PlanEditableCard
            id="dataModels"
            title={dictionary.plan.sections.dataModels.title}
            description={dictionary.plan.sections.dataModels.description}
            action={sectionActions.dataModels}
            inputName="dataModels"
            inputLabel={dictionary.plan.sections.dataModels.inputLabel}
            helperText={dictionary.plan.sections.dataModels.helper}
            defaultValue={serializeDataModels(project.structuredPlan.dataModels)}
            displayKind="dataModels"
            displayDataModels={project.structuredPlan.dataModels}
            changeSummary={dictionary.plan.sections.dataModels.changeSummary}
            editLabel={dictionary.plan.editSection}
            cancelLabel={dictionary.common.cancel}
            saveLabel={dictionary.plan.saveDraft}
            savingLabel={dictionary.plan.saving}
            readOnly={!projectPermissions.canSavePlanDraft}
            readOnlyCopy={operatorPermissionCopy}
          />

          <PlanEditableCard
            id="authRoles"
            title={dictionary.plan.sections.authRoles.title}
            description={dictionary.plan.sections.authRoles.description}
            action={sectionActions.authRoles}
            inputName="authRoles"
            inputLabel={dictionary.plan.sections.authRoles.inputLabel}
            helperText={dictionary.plan.sections.authRoles.helper}
            defaultValue={project.structuredPlan.authRoles.join("\n")}
            displayKind="list"
            displayItems={project.structuredPlan.authRoles}
            changeSummary={dictionary.plan.sections.authRoles.changeSummary}
            editLabel={dictionary.plan.editSection}
            cancelLabel={dictionary.common.cancel}
            saveLabel={dictionary.plan.saveDraft}
            savingLabel={dictionary.plan.saving}
            readOnly={!projectPermissions.canSavePlanDraft}
            readOnlyCopy={operatorPermissionCopy}
          />

          <PlanEditableCard
            id="integrationsNeeded"
            title={dictionary.plan.sections.integrationsNeeded.title}
            description={dictionary.plan.sections.integrationsNeeded.description}
            action={sectionActions.integrationsNeeded}
            inputName="integrationsNeeded"
            inputLabel={dictionary.plan.sections.integrationsNeeded.inputLabel}
            helperText={dictionary.plan.sections.integrationsNeeded.helper}
            defaultValue={project.structuredPlan.integrationsNeeded.join("\n")}
            displayKind="list"
            displayItems={project.structuredPlan.integrationsNeeded}
            changeSummary={dictionary.plan.sections.integrationsNeeded.changeSummary}
            editLabel={dictionary.plan.editSection}
            cancelLabel={dictionary.common.cancel}
            saveLabel={dictionary.plan.saveDraft}
            savingLabel={dictionary.plan.saving}
            readOnly={!projectPermissions.canSavePlanDraft}
            readOnlyCopy={operatorPermissionCopy}
          />

          <PlanEditableCard
            id="designDirection"
            title={dictionary.plan.sections.designDirection.title}
            description={dictionary.plan.sections.designDirection.description}
            action={sectionActions.designDirection}
            inputName="designDirection"
            inputLabel={dictionary.plan.sections.designDirection.inputLabel}
            helperText={dictionary.plan.sections.designDirection.helper}
            defaultValue={project.structuredPlan.designDirection}
            displayKind="text"
            displayText={project.structuredPlan.designDirection}
            changeSummary={dictionary.plan.sections.designDirection.changeSummary}
            editLabel={dictionary.plan.editSection}
            cancelLabel={dictionary.common.cancel}
            saveLabel={dictionary.plan.saveDraft}
            savingLabel={dictionary.plan.saving}
          />
        </div>

        <div className="space-y-6">
          <PlanPlannerRunsCard
            locale={locale}
            dictionary={dictionary}
            planHrefBase={planHrefBase}
            runs={plannerBundle.runs}
            artifacts={plannerBundle.artifacts}
            latestRun={plannerBundle.latestRun}
            selectedPlannerRunId={selectedPlannerRunId}
            selectedPlannerComparisonRunId={selectedPlannerComparisonRunId}
            selectedGenerationRunId={selectedGenerationRunId}
            selectedGenerationComparisonRunId={selectedGenerationComparisonRunId}
            rerunPlannerAction={rerunPlannerAction}
            canRerun={projectPermissions.canRerunPlanner}
            readOnlyCopy={operatorPermissionCopy}
          />

          <PlanPlannerTraceCard
            locale={locale}
            dictionary={dictionary}
            selectedRun={selectedRun}
            adapterRun={plannerComparison.selectedAdapterRun}
            rerunPlannerAction={rerunPlannerAction}
            canRetry={projectPermissions.canRerunPlanner}
            readOnlyCopy={operatorPermissionCopy}
          />

          <PlanPlannerCompareCard
            locale={locale}
            dictionary={dictionary}
            planHrefBase={planHrefBase}
            selectedRun={selectedRun}
            selectedAdapterRun={plannerComparison.selectedAdapterRun}
            comparisonRun={plannerComparison.comparisonRun}
            comparisonAdapterRun={plannerComparison.comparisonAdapterRun}
            selectedComparisonRunId={selectedPlannerComparisonRunId}
            selectedGenerationRunId={selectedGenerationRunId}
            selectedGenerationComparisonRunId={selectedGenerationComparisonRunId}
            delta={plannerComparison.delta}
          />

          <PlanModelAdapterCard
            locale={locale}
            dictionary={dictionary}
            adapterBundle={modelAdapterBundle}
            action={saveModelAdapterConfigAction}
            verifyAction={verifyProviderAction}
            canConfigure={projectPermissions.canRerunPlanner}
            readOnlyCopy={operatorPermissionCopy}
          />

          <ModelAdapterRunHistoryCard
            locale={locale}
            dictionary={dictionary}
            title={dictionary.plan.modelAdapters.runHistory.title}
            copy={dictionary.plan.modelAdapters.runHistory.copy}
            runs={modelAdapterBundle.runs}
            planHrefBase={planHrefBase}
            codeHrefBase={codeHrefBase}
            testIdPrefix="provider-run-history"
          />

          <PlanArtifactInspectorCard
            locale={locale}
            dictionary={dictionary}
            selectedRun={selectedRun}
            selectedArtifacts={selectedArtifacts}
          />

          <PlanRunDeltaCard
            locale={locale}
            dictionary={dictionary}
            selectedRun={selectedRun}
            comparisonRun={plannerComparison.comparisonRun}
          />

          <PlanGenerationPipelineCard
            locale={locale}
            dictionary={dictionary}
            planHrefBase={planHrefBase}
            runs={generationBundle.runs}
            artifacts={generationBundle.artifacts}
            latestRun={generationBundle.latestRun}
            selectedGenerationRunId={selectedGenerationRunId}
            selectedGenerationComparisonRunId={selectedGenerationComparisonRunId}
            selectedPlannerRunId={selectedPlannerRunId}
            selectedPlannerComparisonRunId={selectedPlannerComparisonRunId}
            rerunAction={rerunGenerationAction}
            queueAction={queueGenerationAction}
            refreshQueueItems={promotionBundle.pendingRefreshQueue}
            visualSurface={promotionBundle.visualSurface}
            codeSurface={promotionBundle.codeSurface}
            canQueue={projectPermissions.canQueueGeneration}
            readOnlyCopy={operatorPermissionCopy}
          />

          <PlanGenerationTraceCard
            locale={locale}
            dictionary={dictionary}
            selectedRun={selectedGenerationRun}
            adapterRun={generationComparison.selectedAdapterRun}
            rerunGenerationAction={rerunGenerationAction}
            canRetry={projectPermissions.canQueueGeneration}
            readOnlyCopy={operatorPermissionCopy}
          />

          <PlanGenerationCompareCard
            locale={locale}
            dictionary={dictionary}
            planHrefBase={planHrefBase}
            selectedRun={selectedGenerationRun}
            selectedAdapterRun={generationComparison.selectedAdapterRun}
            comparisonRun={generationComparison.comparisonRun}
            comparisonAdapterRun={generationComparison.comparisonAdapterRun}
            selectedPlannerRunId={selectedPlannerRunId}
            selectedPlannerComparisonRunId={selectedPlannerComparisonRunId}
            selectedComparisonRunId={selectedGenerationComparisonRunId}
            artifacts={generationBundle.artifacts}
          />

          <PlanCandidatePromotionCard
            locale={locale}
            dictionary={dictionary}
            approvedRevision={promotionBundle.approvedRevision}
            candidateRevision={promotionBundle.candidateRevision}
            comparison={promotionBundle.comparison}
            promoteAction={approveAction}
            canPromote={projectPermissions.canApprovePlan}
            readOnlyCopy={approvalPermissionCopy}
          />

          <PlanBuilderImpactCard
            locale={locale}
            dictionary={dictionary}
            workspaceSlug={workspace.slug}
            projectSlug={project.slug}
            surfaces={[
              promotionBundle.visualSurface,
              promotionBundle.codeSurface,
              promotionBundle.previewSurface,
            ]}
            pendingQueue={promotionBundle.pendingRefreshQueue}
            promotionQueueDrafts={promotionBundle.promotionQueueDrafts}
          />

          <PlanReviewActions
            reviewStatusTitle={dictionary.plan.reviewStatusTitle}
            projectStatusTitle={dictionary.plan.projectStatusTitle}
            currentRevisionTitle={dictionary.plan.currentRevision}
            lastUpdatedTitle={dictionary.plan.lastUpdated}
            revisionStateTitle={dictionary.plan.revisionStateTitle}
            statusLabel={statusLabels[project.status][locale]}
            revisionLabel={`${dictionary.plan.revisionPrefix} ${project.currentPlanRevisionNumber}`}
            lastUpdatedLabel={formatDateTimeLabel(project.planLastUpdatedAt, locale)}
            reviewStateLabel={revisionStateLabels[latestRevision.state][locale]}
            needsChangesAction={needsChangesAction}
            reviewNoteLabel={dictionary.plan.reviewNote}
            needsChangesCardTitle={dictionary.plan.needsChangesCardTitle}
            needsChangesDefaultNote={dictionary.plan.needsChangesDefaultNote}
            needsChangesLabel={dictionary.plan.needsChanges}
            savingLabel={dictionary.plan.saving}
            canMarkNeedsChanges={projectPermissions.canApprovePlan}
            readOnlyCopy={approvalPermissionCopy}
          />

          <Card className="px-5 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.plan.revisionHistory}
            </p>
            <div className="mt-4 space-y-3">
              {revisions.map((revision) => (
                <div
                  key={revision.id}
                  id={`revision-${revision.id}`}
                  className="rounded-[24px] border border-border bg-background/70 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-card-foreground">
                        {dictionary.plan.revisionPrefix} {revision.revisionNumber}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateTimeLabel(revision.createdAt, locale)}
                      </p>
                    </div>
                    <Badge className={revisionTone(revision.state)}>
                      {revisionStateLabels[revision.state][locale]}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-card-foreground">{revision.changeSummary}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
