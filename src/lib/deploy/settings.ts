import type {
  DeployAdapterConfigRecord,
  DeployEnvContractVariableRecord,
  DeployTargetValidationIssueRecord,
  DeployTargetValidationResult,
  DeployTargetSettingsRecord,
} from "@/lib/deploy/types";
import type { Locale } from "@/lib/i18n/locales";

export function defaultDeployTargetSettings(): DeployTargetSettingsRecord {
  return {
    adapterPresetKey: "custom",
    adapterKey: "static_snapshot_v1",
    environmentKey: "production",
    primaryDomain: "",
    outputDirectory: ".output/deploy",
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
    ],
    adapterConfig: [
      {
        key: "framework",
        value: "nextjs-app-router",
      },
      {
        key: "artifactMode",
        value: "deploy-snapshot",
      },
    ],
  };
}

export function normalizeDeployTargetSettings(
  value: Partial<DeployTargetSettingsRecord> | Record<string, unknown> | null | undefined,
): DeployTargetSettingsRecord {
  const defaults = defaultDeployTargetSettings();

  if (!value || typeof value !== "object") {
    return defaults;
  }

  const envContract = Array.isArray(value.envContract)
    ? value.envContract.filter(
        (entry): entry is DeployEnvContractVariableRecord =>
          typeof entry === "object" &&
          entry !== null &&
          typeof entry.key === "string" &&
          typeof entry.required === "boolean" &&
          typeof entry.description === "string",
      )
    : defaults.envContract;
  const adapterConfig = Array.isArray(value.adapterConfig)
    ? value.adapterConfig.filter(
        (entry): entry is DeployAdapterConfigRecord =>
          typeof entry === "object" &&
          entry !== null &&
          typeof entry.key === "string" &&
          typeof entry.value === "string",
      )
    : defaults.adapterConfig;

  return {
    adapterPresetKey:
      value.adapterPresetKey === "vercel_nextjs" ||
      value.adapterPresetKey === "netlify_static" ||
      value.adapterPresetKey === "container_node" ||
      value.adapterPresetKey === "custom"
        ? value.adapterPresetKey
        : defaults.adapterPresetKey,
    adapterKey:
      value.adapterKey === "static_snapshot_v1" ||
      value.adapterKey === "vercel_deploy_api_v1" ||
      value.adapterKey === "netlify_bundle_handoff_v1" ||
      value.adapterKey === "container_release_handoff_v1"
        ? value.adapterKey
        : defaults.adapterKey,
    environmentKey:
      typeof value.environmentKey === "string" && value.environmentKey.trim().length > 0
        ? value.environmentKey
        : defaults.environmentKey,
    primaryDomain: typeof value.primaryDomain === "string" ? value.primaryDomain : defaults.primaryDomain,
    outputDirectory:
      typeof value.outputDirectory === "string" && value.outputDirectory.trim().length > 0
        ? value.outputDirectory
        : defaults.outputDirectory,
    installCommand:
      typeof value.installCommand === "string" && value.installCommand.trim().length > 0
        ? value.installCommand
        : defaults.installCommand,
    buildCommand:
      typeof value.buildCommand === "string" && value.buildCommand.trim().length > 0
        ? value.buildCommand
        : defaults.buildCommand,
    startCommand:
      typeof value.startCommand === "string" && value.startCommand.trim().length > 0
        ? value.startCommand
        : defaults.startCommand,
    nodeVersion:
      typeof value.nodeVersion === "string" && value.nodeVersion.trim().length > 0
        ? value.nodeVersion
        : defaults.nodeVersion,
    envContract,
    adapterConfig,
  };
}

export function serializeDeployEnvContract(entries: DeployEnvContractVariableRecord[]) {
  return entries
    .map((entry) => `${entry.key}|${entry.required ? "required" : "optional"}|${entry.description}`)
    .join("\n");
}

export function parseDeployEnvContract(value: string): DeployEnvContractVariableRecord[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [keyPart, requiredPart, ...descriptionParts] = line.split("|");
      const key = (keyPart ?? "").trim();
      const requiredValue = (requiredPart ?? "").trim().toLowerCase();
      const description = descriptionParts.join("|").trim();

      return {
        key,
        required: requiredValue === "required",
        description,
      };
    })
    .filter((entry) => entry.key.length > 0);
}

export function serializeDeployAdapterConfig(entries: DeployAdapterConfigRecord[]) {
  return entries.map((entry) => `${entry.key}|${entry.value}`).join("\n");
}

export function parseDeployAdapterConfig(value: string): DeployAdapterConfigRecord[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [keyPart, ...valueParts] = line.split("|");
      return {
        key: (keyPart ?? "").trim(),
        value: valueParts.join("|").trim(),
      };
    })
    .filter((entry) => entry.key.length > 0);
}

export function suggestedReleaseName(input: {
  projectName: string;
  nextReleaseNumber: number;
  planRevisionNumber: number | null;
}) {
  const revisionSuffix = input.planRevisionNumber ? ` · Rev ${input.planRevisionNumber}` : "";
  return `${input.projectName} Release ${input.nextReleaseNumber}${revisionSuffix}`;
}

function validDomain(value: string) {
  return /^(?=.{4,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(value);
}

function validSlug(value: string) {
  return /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i.test(value);
}

function validCommand(value: string) {
  return value.trim().length > 0 && !/[\r\n]/.test(value);
}

export function validateDeployTargetSettings(
  settings: DeployTargetSettingsRecord,
): DeployTargetValidationResult {
  const issues: DeployTargetValidationIssueRecord[] = [];

  if (!settings.primaryDomain.trim()) {
    issues.push({ field: "primaryDomain", kind: "required" });
  } else if (!validDomain(settings.primaryDomain.trim())) {
    issues.push({ field: "primaryDomain", kind: "invalid_domain" });
  }

  if (!settings.environmentKey.trim()) {
    issues.push({ field: "environmentKey", kind: "required" });
  } else if (!validSlug(settings.environmentKey.trim())) {
    issues.push({ field: "environmentKey", kind: "invalid_slug" });
  }

  if (!settings.outputDirectory.trim()) {
    issues.push({ field: "outputDirectory", kind: "required" });
  }

  const commandFields: Array<keyof Pick<
    DeployTargetSettingsRecord,
    "installCommand" | "buildCommand" | "startCommand"
  >> = ["installCommand", "buildCommand", "startCommand"];

  for (const field of commandFields) {
    if (!settings[field].trim()) {
      issues.push({ field, kind: "required" });
    } else if (!validCommand(settings[field])) {
      issues.push({ field, kind: "invalid_command" });
    }
  }

  if (!settings.nodeVersion.trim()) {
    issues.push({ field: "nodeVersion", kind: "required" });
  }

  const envKeys = new Set<string>();
  let requiredCount = 0;

  for (const entry of settings.envContract) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(entry.key)) {
      issues.push({ field: "envContract", kind: "invalid_env_key", key: entry.key });
    }
    if (envKeys.has(entry.key)) {
      issues.push({ field: "envContract", kind: "duplicate_key", key: entry.key });
    }
    envKeys.add(entry.key);
    if (!entry.description.trim()) {
      issues.push({ field: "envContract", kind: "missing_description", key: entry.key });
    }
    if (entry.required) {
      requiredCount += 1;
    }
  }

  if (requiredCount === 0) {
    issues.push({ field: "envContract", kind: "missing_required_env" });
  }

  const configKeys = new Set<string>();
  for (const entry of settings.adapterConfig) {
    if (!entry.key.trim()) {
      issues.push({ field: "adapterConfig", kind: "required" });
      continue;
    }
    if (configKeys.has(entry.key)) {
      issues.push({ field: "adapterConfig", kind: "duplicate_key", key: entry.key });
    }
    configKeys.add(entry.key);
    if (!entry.value.trim()) {
      issues.push({ field: "adapterConfig", kind: "required", key: entry.key });
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

export function deployValidationMessage(locale: Locale, issue: DeployTargetValidationIssueRecord) {
  const label = issue.key ? ` (${issue.key})` : "";

  if (locale === "sq") {
    switch (issue.kind) {
      case "required":
        return `Kjo fushë kërkohet${label}.`;
      case "invalid_domain":
        return "Primary domain duhet të jetë një hostname i vlefshëm.";
      case "invalid_slug":
        return "Environment key duhet të përdorë vetëm shkronja, numra, - ose _.";
      case "invalid_command":
        return `Komanda nuk mund të jetë bosh ose multiline${label}.`;
      case "duplicate_key":
        return `Ky key është i duplikuar${label}.`;
      case "invalid_env_key":
        return `Env var key duhet të jetë UPPERCASE me underscore${label}.`;
      case "missing_description":
        return `Përshkrimi mungon për këtë env var${label}.`;
      case "missing_required_env":
        return "Duhet të ketë të paktën një env var required për handoff.";
    }
  }

  switch (issue.kind) {
    case "required":
      return `This field is required${label}.`;
    case "invalid_domain":
      return "Primary domain must be a valid hostname.";
    case "invalid_slug":
      return "Environment key must use only letters, numbers, - or _.";
    case "invalid_command":
      return `Command values cannot be empty or multiline${label}.`;
    case "duplicate_key":
      return `This key is duplicated${label}.`;
    case "invalid_env_key":
      return `Env var keys must be uppercase with underscores${label}.`;
    case "missing_description":
      return `This env var is missing a description${label}.`;
    case "missing_required_env":
      return "At least one required env var is needed for handoff.";
  }
}
