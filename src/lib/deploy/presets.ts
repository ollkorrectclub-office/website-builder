import type {
  DeployAdapterPresetKey,
  DeployTargetSettingsRecord,
} from "@/lib/deploy/types";

export interface DeployAdapterPresetRecord {
  key: Exclude<DeployAdapterPresetKey, "custom">;
  outputDirectory: string;
  installCommand: string;
  buildCommand: string;
  startCommand: string;
  nodeVersion: string;
  envContract: DeployTargetSettingsRecord["envContract"];
  adapterConfig: DeployTargetSettingsRecord["adapterConfig"];
}

const DEPLOY_ADAPTER_PRESETS: DeployAdapterPresetRecord[] = [
  {
    key: "vercel_nextjs",
    outputDirectory: ".vercel/output",
    installCommand: "npm install",
    buildCommand: "npm run build",
    startCommand: "npm run start",
    nodeVersion: "22.x",
    envContract: [
      {
        key: "NEXT_PUBLIC_APP_URL",
        required: true,
        description: "Primary public URL used by the generated app shell.",
      },
      {
        key: "VERCEL_PROJECT_PRODUCTION_URL",
        required: false,
        description: "Provider-injected production hostname exposed by Vercel.",
      },
    ],
    adapterConfig: [
      { key: "provider", value: "vercel" },
      { key: "framework", value: "nextjs-app-router" },
      { key: "outputMode", value: "build-output-api" },
    ],
  },
  {
    key: "netlify_static",
    outputDirectory: "out",
    installCommand: "npm install",
    buildCommand: "npm run build",
    startCommand: "npx serve out",
    nodeVersion: "22.x",
    envContract: [
      {
        key: "NEXT_PUBLIC_APP_URL",
        required: true,
        description: "Primary public URL used by the generated app shell.",
      },
      {
        key: "NETLIFY_SITE_ID",
        required: false,
        description: "Target Netlify site identifier for future adapter execution.",
      },
    ],
    adapterConfig: [
      { key: "provider", value: "netlify" },
      { key: "publishDirectory", value: "out" },
      { key: "framework", value: "static-export" },
    ],
  },
  {
    key: "container_node",
    outputDirectory: ".output/container",
    installCommand: "npm ci",
    buildCommand: "npm run build",
    startCommand: "npm run start",
    nodeVersion: "22.x",
    envContract: [
      {
        key: "PORT",
        required: true,
        description: "Runtime port injected by the hosting platform.",
      },
      {
        key: "NEXT_PUBLIC_APP_URL",
        required: true,
        description: "Primary public URL used by the generated app shell.",
      },
    ],
    adapterConfig: [
      { key: "provider", value: "container" },
      { key: "runtime", value: "nodejs" },
      { key: "healthcheckPath", value: "/api/health" },
    ],
  },
];

export function listDeployAdapterPresets() {
  return DEPLOY_ADAPTER_PRESETS;
}

export function getDeployAdapterPreset(key: DeployAdapterPresetKey) {
  return DEPLOY_ADAPTER_PRESETS.find((preset) => preset.key === key) ?? null;
}

export function applyDeployAdapterPreset(
  current: DeployTargetSettingsRecord,
  presetKey: Exclude<DeployAdapterPresetKey, "custom">,
): DeployTargetSettingsRecord {
  const preset = getDeployAdapterPreset(presetKey);

  if (!preset) {
    return current;
  }

  return {
    ...current,
    adapterPresetKey: preset.key,
    adapterKey:
      preset.key === "vercel_nextjs"
        ? "vercel_deploy_api_v1"
        : preset.key === "netlify_static"
          ? "netlify_bundle_handoff_v1"
          : "container_release_handoff_v1",
    outputDirectory: preset.outputDirectory,
    installCommand: preset.installCommand,
    buildCommand: preset.buildCommand,
    startCommand: preset.startCommand,
    nodeVersion: preset.nodeVersion,
    envContract: preset.envContract,
    adapterConfig:
      preset.key === "vercel_nextjs"
        ? [
            ...preset.adapterConfig,
            { key: "apiBaseUrl", value: "https://api.vercel.com" },
            { key: "tokenEnvVar", value: "VERCEL_TOKEN" },
            { key: "projectName", value: "project-slug" },
            { key: "deploymentTarget", value: "production" },
          ]
        : preset.adapterConfig,
  };
}
