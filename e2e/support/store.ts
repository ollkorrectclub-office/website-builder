import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  e2eDeployStubPort,
  e2eGenerationModel,
  e2eLiveDeployApiBaseUrl,
  e2eLiveDeployProjectName,
  e2eLiveDeployTarget,
  e2eLiveDeployTeamId,
  e2eLiveDeployTeamSlug,
  e2eLiveProviderEndpoint,
  e2ePatchModel,
  e2ePlanningModel,
  e2eDeployMode,
  e2eProjectSlug,
  e2eProviderApiKeyEnvVar,
  e2eProviderMode,
  e2eProviderStubBaseUrl,
  e2eWorkspaceSlug,
} from "./env";

const root = process.cwd();
export const runtimeE2EStoreFile = path.join(
  root,
  process.env.BESA_E2E_STORE_FILE ?? path.join(".data", "phase32-e2e-store.json"),
);

function fixturePath(name: string) {
  return path.join(root, "e2e", "fixtures", name);
}

export async function copyE2EStoreFixture(name: string) {
  if (process.env.BESA_E2E_MODE === "supabase") {
    return;
  }

  await mkdir(path.dirname(runtimeE2EStoreFile), { recursive: true });
  await cp(fixturePath(name), runtimeE2EStoreFile);
}

export async function resetE2EStore() {
  await copyE2EStoreFixture("local-store-baseline.json");
}

export async function resetAdapterCompareStore() {
  await copyE2EStoreFixture("adapter-compare-store.json");
}

export async function resetDeployExecutionStore() {
  await copyE2EStoreFixture("deploy-execution-store.json");
}

function upsertAdapterConfigEntry(
  entries: Array<{ key: string; value: string }>,
  key: string,
  value: string | null,
) {
  const nextEntries = entries.filter((entry) => entry.key !== key);

  if (value && value.trim().length > 0) {
    nextEntries.push({ key, value });
  }

  return nextEntries;
}

export async function resetDeployExecutionSmokeStore() {
  await resetDeployExecutionStore();

  if (process.env.BESA_E2E_MODE === "supabase") {
    return;
  }

  const store = JSON.parse(await readFile(runtimeE2EStoreFile, "utf-8")) as {
    deployTargets: Array<Record<string, unknown>>;
    deployReleases: Array<Record<string, unknown>>;
    deployExecutionRuns: Array<Record<string, unknown>>;
    projectAuditTimelineEvents: Array<Record<string, unknown>>;
  };

  const timestamp = new Date().toISOString();
  const target = store.deployTargets[0];
  const release = store.deployReleases[0];

  if (!target || !release) {
    throw new Error("Unable to seed the deploy execution smoke store.");
  }

  const targetSettings =
    target.settings && typeof target.settings === "object"
      ? (target.settings as {
          adapterConfig?: Array<{ key: string; value: string }>;
        })
      : null;

  if (!targetSettings || !Array.isArray(targetSettings.adapterConfig)) {
    throw new Error("Deploy target settings are missing adapter config.");
  }

  const apiBaseUrl =
    e2eDeployMode === "live"
      ? e2eLiveDeployApiBaseUrl
      : `http://127.0.0.1:${e2eDeployStubPort}`;
  let adapterConfig = [...targetSettings.adapterConfig];

  adapterConfig = upsertAdapterConfigEntry(adapterConfig, "apiBaseUrl", apiBaseUrl);
  adapterConfig = upsertAdapterConfigEntry(adapterConfig, "tokenEnvVar", "VERCEL_TOKEN");
  adapterConfig = upsertAdapterConfigEntry(
    adapterConfig,
    "projectName",
    e2eLiveDeployProjectName || "phase46-smoke",
  );
  adapterConfig = upsertAdapterConfigEntry(
    adapterConfig,
    "deploymentTarget",
    e2eDeployMode === "live" ? e2eLiveDeployTarget : "preview",
  );
  adapterConfig = upsertAdapterConfigEntry(
    adapterConfig,
    "teamId",
    e2eDeployMode === "live" ? e2eLiveDeployTeamId || null : null,
  );
  adapterConfig = upsertAdapterConfigEntry(
    adapterConfig,
    "teamSlug",
    e2eDeployMode === "live" ? e2eLiveDeployTeamSlug || null : null,
  );

  targetSettings.adapterConfig = adapterConfig;
  target.latestExecutionRunId = null;
  target.latestExecutionRunStatus = null;
  target.hostedDeployment = null;
  target.updatedAt = timestamp;

  release.latestExecutionRunId = null;
  release.latestExecutionStatus = null;
  release.hostedDeployment = null;
  release.updatedAt = timestamp;

  store.deployExecutionRuns = [];
  store.projectAuditTimelineEvents = store.projectAuditTimelineEvents.filter((event) => {
    const kind = typeof event.kind === "string" ? event.kind : "";
    return (
      kind !== "deploy_execution_run" &&
      kind !== "deploy_execution_rechecked" &&
      kind !== "deploy_execution_retried"
    );
  });

  await writeFile(runtimeE2EStoreFile, JSON.stringify(store, null, 2), "utf-8");
}

export async function resetProviderVerificationStore() {
  await resetE2EStore();

  if (process.env.BESA_E2E_MODE === "supabase") {
    return;
  }

  const store = JSON.parse(await readFile(runtimeE2EStoreFile, "utf-8")) as {
    workspaces: Array<{ id: string; slug: string }>;
    projects: Array<{ id: string; workspaceId: string; slug: string }>;
    modelAdapterConfigs: Array<Record<string, unknown>>;
    modelAdapterRuns: Array<Record<string, unknown>>;
  };
  const workspace = store.workspaces.find((entry) => entry.slug === e2eWorkspaceSlug);
  const project = store.projects.find(
    (entry) => entry.slug === e2eProjectSlug && entry.workspaceId === workspace?.id,
  );

  if (!workspace || !project) {
    throw new Error("Unable to seed the provider verification store for the configured workspace/project.");
  }

  const timestamp = new Date().toISOString();

  store.modelAdapterConfigs = [
    {
      id: "model_adapter_config_e2e_provider",
      workspaceId: workspace.id,
      projectId: project.id,
      planningSelection: "external_model",
      generationSelection: "external_model",
      patchSelection: "external_model",
      externalProviderKey: "openai_compatible",
      externalProviderLabel: e2eProviderMode === "live" ? "OpenAI-compatible live" : "OpenAI-compatible stub",
      externalEndpointUrl: e2eProviderMode === "live" ? e2eLiveProviderEndpoint || null : e2eProviderStubBaseUrl,
      externalApiKeyEnvVar: e2eProviderApiKeyEnvVar,
      planningModel: e2ePlanningModel,
      generationModel: e2eGenerationModel,
      patchModel: e2ePatchModel,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  store.modelAdapterRuns = [];

  await writeFile(runtimeE2EStoreFile, JSON.stringify(store, null, 2), "utf-8");
}

export async function expireWorkspaceInvitationInLocalStore(email: string) {
  if (process.env.BESA_E2E_MODE === "supabase") {
    throw new Error("Local store helpers are not available in Supabase E2E mode.");
  }

  const store = JSON.parse(await readFile(runtimeE2EStoreFile, "utf-8")) as {
    workspaceInvitations: Array<Record<string, unknown>>;
  };
  const invitation = store.workspaceInvitations.find(
    (entry) =>
      typeof entry.email === "string" &&
      entry.email.toLowerCase() === email.toLowerCase() &&
      (entry.status === "pending" || typeof entry.status !== "string"),
  );

  if (!invitation) {
    throw new Error(`No pending invitation was found for ${email}.`);
  }

  invitation.expiresAt = "2000-01-01T00:00:00.000Z";
  invitation.expires_at = invitation.expiresAt;
  invitation.updatedAt = new Date().toISOString();
  invitation.updated_at = invitation.updatedAt;

  await writeFile(runtimeE2EStoreFile, JSON.stringify(store, null, 2), "utf-8");
}
