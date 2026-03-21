export type E2EMode = "local" | "supabase";
export type E2EProviderMode = "stub" | "live";
export type E2EDeployMode = "stub" | "live";

function normalizeMode(value: string | undefined): E2EMode {
  return value === "supabase" ? "supabase" : "local";
}

function normalizeProviderMode(value: string | undefined): E2EProviderMode {
  return value === "live" ? "live" : "stub";
}

function normalizeDeployMode(value: string | undefined): E2EDeployMode {
  return value === "live" ? "live" : "stub";
}

export const e2eMode = normalizeMode(process.env.BESA_E2E_MODE);
export const e2eProviderMode = normalizeProviderMode(process.env.BESA_E2E_PROVIDER_MODE);
export const e2eDeployMode = normalizeDeployMode(process.env.BESA_E2E_DEPLOY_MODE);
export const e2eLocale =
  process.env.BESA_E2E_LOCALE ??
  process.env.BESA_E2E_SUPABASE_LOCALE ??
  "en";
export const e2eProviderStubPort = Number(process.env.BESA_E2E_PROVIDER_STUB_PORT ?? "3291");
export const e2eDeployStubPort = Number(process.env.BESA_E2E_DEPLOY_STUB_PORT ?? "4022");
export const e2eProviderStubBaseUrl =
  process.env.BESA_E2E_PROVIDER_STUB_BASE_URL ??
  `http://127.0.0.1:${e2eProviderStubPort}/v1`;
export const e2eLiveProviderEndpoint =
  process.env.BESA_E2E_LIVE_PROVIDER_ENDPOINT ?? "";
export const e2eLiveDeployApiBaseUrl =
  process.env.BESA_E2E_LIVE_DEPLOY_API_BASE_URL?.trim() || "https://api.vercel.com";
export const e2eLiveDeployProjectName =
  process.env.BESA_E2E_LIVE_DEPLOY_PROJECT_NAME?.trim() || "";
export const e2eLiveDeployTeamId =
  process.env.BESA_E2E_LIVE_DEPLOY_TEAM_ID?.trim() || "";
export const e2eLiveDeployTeamSlug =
  process.env.BESA_E2E_LIVE_DEPLOY_TEAM_SLUG?.trim() || "";
export const e2eLiveDeployTarget =
  process.env.BESA_E2E_LIVE_DEPLOY_TARGET?.trim() || "preview";
export const e2eProviderApiKeyEnvVar =
  process.env.BESA_E2E_PROVIDER_API_KEY_ENV_VAR ?? "OPENAI_API_KEY";
export const e2ePlanningModel =
  process.env.BESA_E2E_PROVIDER_PLANNING_MODEL ?? "gpt-5.4-mini";
export const e2eGenerationModel =
  process.env.BESA_E2E_PROVIDER_GENERATION_MODEL ?? "gpt-5.4-mini";
export const e2ePatchModel =
  process.env.BESA_E2E_PROVIDER_PATCH_MODEL ?? "gpt-5.4-mini";

export const e2eWorkspaceSlug =
  e2eMode === "supabase"
    ? process.env.BESA_E2E_SUPABASE_WORKSPACE_SLUG ?? ""
    : "besa-studio";

export const e2eProjectSlug =
  e2eMode === "supabase"
    ? process.env.BESA_E2E_SUPABASE_PROJECT_SLUG ?? ""
    : "denta-plus-tirana";

export const e2eProjectBasePath =
  e2eWorkspaceSlug && e2eProjectSlug
    ? `/${e2eLocale}/app/workspaces/${e2eWorkspaceSlug}/projects/${e2eProjectSlug}`
    : "";

export function isLocalE2EMode() {
  return e2eMode === "local";
}

export function isSupabaseE2EMode() {
  return e2eMode === "supabase";
}

export function isLiveProviderE2EMode() {
  return e2eProviderMode === "live";
}

export function isLiveDeployE2EMode() {
  return e2eDeployMode === "live";
}
