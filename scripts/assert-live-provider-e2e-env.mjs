const requiredEnvVars = ["OPENAI_API_KEY"];

const missing = requiredEnvVars.filter((key) => {
  const value = process.env[key];
  return !value || value.trim().length === 0;
});

if (missing.length > 0) {
  console.error(
    [
      "Live provider smoke verification is not configured.",
      "Set these env vars before running `npm run test:e2e:provider-live-smoke`:",
      ...missing.map((key) => `- ${key}`),
    ].join("\n"),
  );
  process.exit(1);
}
