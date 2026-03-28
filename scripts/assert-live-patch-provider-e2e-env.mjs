function value(key) {
  return process.env[key]?.trim() ?? "";
}

const configuredApiKeyEnvVar = value("EXTERNAL_PATCH_API_KEY_ENV_VAR") || "OPENAI_API_KEY";
const requiredEnvVars = [
  configuredApiKeyEnvVar,
  "ENABLE_EXTERNAL_PATCH_SUGGESTION",
  "EXTERNAL_PATCH_MODEL",
];

const missing = requiredEnvVars.filter((key) => {
  const currentValue = process.env[key];
  return !currentValue || currentValue.trim().length === 0;
});

if (missing.length > 0) {
  console.error(
    [
      "Live patch provider verification is not configured.",
      "Set these env vars before running `npm run test:e2e:patch-provider:live-proof`:",
      ...missing.map((key) => `- ${key}`),
      "",
      `The external patch adapter will read its hosted API key from ${configuredApiKeyEnvVar}.`,
    ].join("\n"),
  );
  process.exit(1);
}
