const requiredEnvVars = ["VERCEL_TOKEN", "BESA_E2E_LIVE_DEPLOY_PROJECT_NAME"];

const missing = requiredEnvVars.filter((key) => {
  const value = process.env[key];
  return !value || value.trim().length === 0;
});

if (missing.length > 0) {
  console.error(
    [
      "Live deploy execution smoke verification is not configured.",
      "Set these env vars before running `npm run test:e2e:deploy-execution:live-smoke`:",
      ...missing.map((key) => `- ${key}`),
    ].join("\n"),
  );
  process.exit(1);
}
