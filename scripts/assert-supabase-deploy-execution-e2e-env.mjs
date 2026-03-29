const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "BESA_E2E_SUPABASE_OWNER_EMAIL",
  "BESA_E2E_SUPABASE_OWNER_PASSWORD",
];

const missing = requiredEnvVars.filter((key) => {
  const value = process.env[key];
  return !value || value.trim().length === 0;
});

const sharedWorkspaceSlug = process.env.BESA_E2E_SUPABASE_WORKSPACE_SLUG?.trim() ?? "";
const sharedProjectSlug = process.env.BESA_E2E_SUPABASE_PROJECT_SLUG?.trim() ?? "";
const deployWorkspaceSlug = process.env.BESA_E2E_SUPABASE_DEPLOY_WORKSPACE_SLUG?.trim() ?? "";
const deployProjectSlug = process.env.BESA_E2E_SUPABASE_DEPLOY_PROJECT_SLUG?.trim() ?? "";

const hasDeploySpecificRoute = deployWorkspaceSlug.length > 0 || deployProjectSlug.length > 0;
const hasSharedRoute = sharedWorkspaceSlug.length > 0 && sharedProjectSlug.length > 0;
const hasCompleteDeploySpecificRoute = deployWorkspaceSlug.length > 0 && deployProjectSlug.length > 0;

if (hasDeploySpecificRoute && !hasCompleteDeploySpecificRoute) {
  console.error(
    [
      "Supabase deploy execution parity verification expects both deploy-specific route vars together.",
      "Set these env vars before running `npm run test:e2e:supabase:deploy-execution`:",
      "- BESA_E2E_SUPABASE_DEPLOY_WORKSPACE_SLUG",
      "- BESA_E2E_SUPABASE_DEPLOY_PROJECT_SLUG",
    ].join("\n"),
  );
  process.exit(1);
}

if (!hasCompleteDeploySpecificRoute && !hasSharedRoute) {
  console.error(
    [
      "Supabase deploy execution parity verification is not configured.",
      "Set one complete project route before running `npm run test:e2e:supabase:deploy-execution`:",
      "- BESA_E2E_SUPABASE_DEPLOY_WORKSPACE_SLUG + BESA_E2E_SUPABASE_DEPLOY_PROJECT_SLUG (recommended for Phase 50 deploy proof)",
      "- or BESA_E2E_SUPABASE_WORKSPACE_SLUG + BESA_E2E_SUPABASE_PROJECT_SLUG",
    ].join("\n"),
  );
  process.exit(1);
}

if (missing.length > 0) {
  console.error(
    [
      "Supabase deploy execution parity verification is not configured.",
      "Set these env vars before running `npm run test:e2e:supabase:deploy-execution`:",
      ...missing.map((key) => `- ${key}`),
    ].join("\n"),
  );
  process.exit(1);
}
