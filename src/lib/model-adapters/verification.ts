import { buildProjectPermissions, buildWorkspacePermissions } from "@/lib/auth/access";
import { ExternalPatchSuggestionAdapter } from "@/lib/builder/external-model-patch-suggester";
import type { ProjectCapabilities } from "@/lib/workspaces/types";
import { ExternalProviderExecutionError, ModelAdapterExecutionError } from "@/lib/model-adapters/errors";
import { resolveCapabilityAdapterConfig } from "@/lib/model-adapters/registry";
import type {
  ModelAdapterCapability,
  ModelAdapterExecutionRecord,
  ModelAdapterSelection,
  ProjectModelAdapterConfigRecord,
  ResolvedCapabilityAdapterConfig,
} from "@/lib/model-adapters/types";
import { ExternalModelPlannerAdapter } from "@/lib/planner/external-model-planner";
import { ExternalCodegenAdapter } from "@/lib/generation/external-model-generator";

function emptyCapabilities(): ProjectCapabilities {
  return {
    auth: false,
    payments: false,
    cms: false,
    fileUpload: false,
    aiChat: false,
    calendar: false,
    analytics: false,
  };
}

function sampleSupportedLocales(): Array<"en" | "sq"> {
  return ["en"];
}

function requestedAdapterKey(capability: ModelAdapterCapability) {
  switch (capability) {
    case "planning":
      return "external_model_adapter_v1";
    case "generation":
      return "external_codegen_adapter_v1";
    case "patch_suggestion":
      return "external_patch_adapter_v1";
  }
}

function capabilityLabel(capability: ModelAdapterCapability) {
  switch (capability) {
    case "planning":
      return "planning";
    case "generation":
      return "generation";
    case "patch_suggestion":
      return "patch suggestion";
  }
}

function buildExecutionRecord(
  resolved: ResolvedCapabilityAdapterConfig,
  input: {
    latencyMs?: number | null;
    trace?: ModelAdapterExecutionRecord["trace"];
    summary: string;
    errorMessage?: string | null;
  },
): ModelAdapterExecutionRecord {
  return {
    capability: resolved.capability,
    requestedSelection: resolved.selection,
    executedSelection: "external_model",
    sourceType: "external_model",
    executionMode: "selected",
    requestedAdapterKey: requestedAdapterKey(resolved.capability),
    executedAdapterKey: requestedAdapterKey(resolved.capability),
    providerKey: resolved.providerKey,
    providerLabel: resolved.providerLabel,
    modelName: resolved.modelName,
    endpointUrl: resolved.endpointUrl,
    latencyMs: input.latencyMs ?? null,
    trace: input.trace ?? null,
    fallbackReason: null,
    summary: input.summary,
    metadata: {
      runKind: "provider_verification",
      verificationScope: "live_provider_check",
      capability: resolved.capability,
      errorMessage: input.errorMessage ?? null,
    },
  };
}

export function buildProviderVerificationFailureExecution(
  config: ProjectModelAdapterConfigRecord,
  capability: ModelAdapterCapability,
  message: string,
) {
  const resolved = resolveCapabilityAdapterConfig(config, capability);

  return buildExecutionRecord(resolved, {
    summary: `Live provider verification failed for ${capabilityLabel(capability)}.`,
    errorMessage: message,
  });
}

function buildSampleGenerationInput() {
  const timestamp = new Date().toISOString();
  const supportedLocales = sampleSupportedLocales();
  const workspace = {
    id: "workspace_verify_provider",
    slug: "verify-provider",
    name: "Verify Provider",
    ownerUserId: "user_verify_provider",
    createdByUserId: "user_verify_provider",
    businessCategory: "Healthcare",
    country: "albania" as const,
    defaultLocale: "en" as const,
    supportedLocales,
    companyName: "Verify Provider LLC",
    intentNotes: "Verification-only workspace",
    onboardingPayload: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const approvedRevision = {
    id: "plan_revision_verify_provider",
    projectId: "project_verify_provider",
    revisionNumber: 4,
    state: "approved" as const,
    editedSection: "status" as const,
    changeSummary: "Approved verification revision",
    plannerSource: "rules_planner_v1" as const,
    plan: {
      productSummary: "Launch website for a small dental clinic.",
      targetUsers: ["New patients", "Returning patients"],
      pageMap: ["Home", "Treatments", "Pricing", "Contact"],
      featureList: ["Lead capture", "Clinic profile", "Pricing overview"],
      dataModels: [
        {
          name: "Inquiry",
          description: "Stores patient contact requests from the public site.",
        },
      ],
      authRoles: ["Admin"],
      integrationsNeeded: ["Email notifications"],
      designDirection: "Warm clinical minimalism with strong trust signals.",
    },
    createdAt: timestamp,
  };
  const project = {
    id: "project_verify_provider",
    workspaceId: workspace.id,
    slug: "provider-verification",
    name: "Provider Verification",
    ownerUserId: "user_verify_provider",
    createdByUserId: "user_verify_provider",
    startingMode: "prompt" as const,
    status: "plan_approved" as const,
    projectType: "website" as const,
    prompt: "Create a launch-ready dental clinic website.",
    targetUsers: "Patients looking for a clinic in Tirana.",
    desiredPagesFeatures: ["Home", "Treatments", "Pricing", "Contact"],
    designStyle: "premium-minimal",
    primaryLocale: "en" as const,
    supportedLocales,
    country: "albania" as const,
    businessCategory: "Healthcare",
    capabilities: emptyCapabilities(),
    intakePayload: {},
    structuredPlan: approvedRevision.plan,
    currentPlanRevisionId: approvedRevision.id,
    currentPlanRevisionNumber: approvedRevision.revisionNumber,
    planLastUpdatedAt: timestamp,
    plannerSource: "rules_planner_v1" as const,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const currentUser = {
    id: "user_verify_provider",
    email: "verify@example.com",
    fullName: "Verify Operator",
    companyName: "Verify Provider LLC",
  };
  const membership = {
    id: "membership_verify_provider",
    workspaceId: workspace.id,
    userId: currentUser.id,
    role: "owner" as const,
    status: "active" as const,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    workspace,
    project,
    revisions: [approvedRevision],
    approvedRevision,
    currentUser,
    membership,
    workspacePermissions: buildWorkspacePermissions(membership.role),
    projectPermissions: buildProjectPermissions({
      membership,
      project,
      user: currentUser,
    }),
  };
}

async function verifyPlanning(resolved: ResolvedCapabilityAdapterConfig) {
  const adapter = new ExternalModelPlannerAdapter({
    providerKey: resolved.providerKey ?? "custom_http",
    providerLabel: resolved.providerLabel ?? "External provider",
    modelName: resolved.modelName ?? "unknown-model",
    endpointUrl: resolved.endpointUrl,
    apiKeyEnvVar: resolved.apiKeyEnvVar ?? "",
  });
  const execution = await adapter.plan(
    {
      name: "Provider Verification",
      prompt: "Create a launch-ready dental clinic site for Tirana.",
      projectType: "website",
      targetUsers: "New and returning patients",
      desiredPagesFeatures: ["Home", "Treatments", "Pricing", "Contact"],
      designStyle: "premium-minimal",
      primaryLocale: "en",
      supportedLocales: sampleSupportedLocales(),
      country: "albania",
      businessCategory: "Healthcare",
      capabilities: emptyCapabilities(),
    },
    "project_rerun",
  );

  return execution.execution;
}

async function verifyGeneration(resolved: ResolvedCapabilityAdapterConfig) {
  const adapter = new ExternalCodegenAdapter({
    providerKey: resolved.providerKey ?? "custom_http",
    providerLabel: resolved.providerLabel ?? "External provider",
    modelName: resolved.modelName ?? "unknown-model",
    endpointUrl: resolved.endpointUrl,
    apiKeyEnvVar: resolved.apiKeyEnvVar ?? "",
  });
  const execution = await adapter.generate(buildSampleGenerationInput(), "manual_rerun");

  return execution.execution;
}

async function verifyPatchSuggestion(resolved: ResolvedCapabilityAdapterConfig) {
  const adapter = new ExternalPatchSuggestionAdapter({
    providerKey: resolved.providerKey ?? "custom_http",
    providerLabel: resolved.providerLabel ?? "External provider",
    modelName: resolved.modelName ?? "unknown-model",
    endpointUrl: resolved.endpointUrl,
    apiKeyEnvVar: resolved.apiKeyEnvVar ?? "",
  });
  const execution = await adapter.suggest({
    file: {
      path: "app/[locale]/page.tsx",
      name: "page.tsx",
      kind: "route",
      language: "tsx",
    },
    currentContent: [
      "export default function HomePage() {",
      "  return <main><h1>Clinic</h1><p>Book an appointment.</p></main>;",
      "}",
    ].join("\n"),
    requestPrompt: "Improve the headline and body copy for stronger conversion intent.",
  });

  return execution.execution;
}

export async function verifyExternalProviderCapability(
  config: ProjectModelAdapterConfigRecord,
  capability: ModelAdapterCapability,
) {
  const resolved = resolveCapabilityAdapterConfig(config, capability);

  if (resolved.selection !== "external_model") {
    throw new ModelAdapterExecutionError(
      "Live provider verification is available only when the capability is set to the external adapter.",
      buildExecutionRecord(resolved, {
        summary: `Live provider verification was skipped because ${capabilityLabel(capability)} is still pinned to deterministic mode.`,
        errorMessage: "External adapter is not selected.",
      }),
    );
  }

  if (!resolved.externalReady) {
    throw new ModelAdapterExecutionError(
      `External ${capabilityLabel(capability)} config is incomplete: ${resolved.missingFields.join(", ")}.`,
      buildExecutionRecord(resolved, {
        summary: `Live provider verification failed before request setup for ${capabilityLabel(capability)}.`,
        errorMessage: `Missing config fields: ${resolved.missingFields.join(", ")}.`,
      }),
    );
  }

  try {
    const execution =
      capability === "planning"
        ? await verifyPlanning(resolved)
        : capability === "generation"
          ? await verifyGeneration(resolved)
          : await verifyPatchSuggestion(resolved);

    return buildExecutionRecord(resolved, {
      latencyMs: execution.latencyMs,
      trace: execution.trace,
      summary: `Live provider verification succeeded for ${capabilityLabel(capability)} using ${resolved.providerLabel ?? resolved.providerKey ?? "the configured provider"}.`,
    });
  } catch (error) {
    const providerError = error instanceof ExternalProviderExecutionError ? error : null;
    const message =
      error instanceof Error ? error.message : `Live provider verification failed for ${capabilityLabel(capability)}.`;

    throw new ModelAdapterExecutionError(
      message,
      buildExecutionRecord(resolved, {
        latencyMs: providerError?.latencyMs ?? null,
        trace: providerError?.trace ?? null,
        summary: `Live provider verification failed for ${capabilityLabel(capability)}.`,
        errorMessage: message,
      }),
    );
  }
}
