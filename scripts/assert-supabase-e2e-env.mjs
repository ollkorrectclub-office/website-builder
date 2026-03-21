const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "BESA_E2E_SUPABASE_OWNER_EMAIL",
  "BESA_E2E_SUPABASE_OWNER_PASSWORD",
  "BESA_E2E_SUPABASE_WORKSPACE_SLUG",
  "BESA_E2E_SUPABASE_PROJECT_SLUG",
];

const missing = requiredEnvVars.filter((key) => {
  const value = process.env[key];
  return !value || value.trim().length === 0;
});

if (missing.length > 0) {
  console.error(
    [
      "Supabase E2E verification is not configured.",
      "Set these env vars before running `npm run test:e2e:supabase`:",
      ...missing.map((key) => `- ${key}`),
    ].join("\n"),
  );
  process.exit(1);
}
