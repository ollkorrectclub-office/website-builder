import type { Dictionary } from "@/lib/i18n/dictionaries";

import type {
  DeployAdapterPresetKey,
  DeployAdapterKey,
  DeployArtifactType,
  DeployExecutionRunStatus,
  DeployExecutionSource,
  DeployHandoffRunStatus,
  DeployReleaseStatus,
  DeployRunStatus,
  DeployRunTrigger,
  DeploySource,
  DeployTargetStatus,
} from "@/lib/deploy/types";

export function deploySourceLabel(dictionary: Dictionary, source: DeploySource) {
  switch (source) {
    case "deterministic_deployer_v1":
      return dictionary.builder.deploy.labels.sourceDeterministic;
  }
}

export function deployRunStatusLabel(dictionary: Dictionary, status: DeployRunStatus) {
  switch (status) {
    case "completed":
      return dictionary.builder.deploy.labels.statusCompleted;
    case "failed":
      return dictionary.builder.deploy.labels.statusFailed;
  }
}

export function deployTargetStatusLabel(dictionary: Dictionary, status: DeployTargetStatus) {
  switch (status) {
    case "idle":
      return dictionary.builder.deploy.labels.targetIdle;
    case "snapshot_ready":
      return dictionary.builder.deploy.labels.targetReady;
    case "failed":
      return dictionary.builder.deploy.labels.targetFailed;
  }
}

export function deployTriggerLabel(dictionary: Dictionary, trigger: DeployRunTrigger) {
  switch (trigger) {
    case "publish_requested":
      return dictionary.builder.deploy.labels.triggerPublish;
  }
}

export function deployArtifactTypeLabel(dictionary: Dictionary, artifactType: DeployArtifactType) {
  switch (artifactType) {
    case "deploy_snapshot_manifest":
      return dictionary.builder.deploy.artifacts.snapshotManifest;
    case "deploy_route_bundle":
      return dictionary.builder.deploy.artifacts.routeBundle;
    case "deploy_theme_bundle":
      return dictionary.builder.deploy.artifacts.themeBundle;
    case "deploy_output_package":
      return dictionary.builder.deploy.artifacts.outputPackage;
  }
}

export function deployAdapterPresetLabel(dictionary: Dictionary, presetKey: DeployAdapterPresetKey) {
  switch (presetKey) {
    case "custom":
      return dictionary.builder.deploy.labels.presetCustom;
    case "vercel_nextjs":
      return dictionary.builder.deploy.labels.presetVercel;
    case "netlify_static":
      return dictionary.builder.deploy.labels.presetNetlify;
    case "container_node":
      return dictionary.builder.deploy.labels.presetContainer;
  }
}

export function deployAdapterKeyLabel(dictionary: Dictionary, adapterKey: DeployAdapterKey) {
  switch (adapterKey) {
    case "static_snapshot_v1":
      return dictionary.builder.deploy.labels.adapterStaticSnapshot;
    case "vercel_deploy_api_v1":
      return dictionary.builder.deploy.labels.adapterVercel;
    case "netlify_bundle_handoff_v1":
      return dictionary.builder.deploy.labels.adapterNetlify;
    case "container_release_handoff_v1":
      return dictionary.builder.deploy.labels.adapterContainer;
  }
}

export function deployHandoffRunStatusLabel(dictionary: Dictionary, status: DeployHandoffRunStatus) {
  switch (status) {
    case "blocked":
      return dictionary.builder.deploy.labels.handoffBlocked;
    case "completed":
      return dictionary.builder.deploy.labels.handoffCompleted;
    case "failed":
      return dictionary.builder.deploy.labels.handoffFailed;
  }
}

export function deployReleaseStatusLabel(dictionary: Dictionary, status: DeployReleaseStatus) {
  switch (status) {
    case "promoted":
      return dictionary.builder.deploy.labels.releasePromoted;
    case "handoff_ready":
      return dictionary.builder.deploy.labels.releaseHandoffReady;
    case "exported":
      return dictionary.builder.deploy.labels.releaseExported;
  }
}

export function deployExecutionRunStatusLabel(
  dictionary: Dictionary,
  status: DeployExecutionRunStatus,
) {
  switch (status) {
    case "blocked":
      return dictionary.builder.deploy.labels.executionBlocked;
    case "submitted":
      return dictionary.builder.deploy.labels.executionSubmitted;
    case "ready":
      return dictionary.builder.deploy.labels.executionReady;
    case "failed":
      return dictionary.builder.deploy.labels.executionFailed;
  }
}

export function deployExecutionSourceLabel(
  dictionary: Dictionary,
  source: DeployExecutionSource,
) {
  switch (source) {
    case "vercel_deploy_api_v1":
      return dictionary.builder.deploy.labels.executionVercel;
    case "unsupported_hosting_adapter_v1":
      return dictionary.builder.deploy.labels.executionUnsupported;
  }
}
