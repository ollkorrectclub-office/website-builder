import { existsSync } from "node:fs";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.BESA_E2E_APP_PORT ?? "3210");
const providerStubPort = Number(process.env.BESA_E2E_PROVIDER_STUB_PORT ?? "3291");
const deployStubPort = Number(process.env.BESA_E2E_DEPLOY_STUB_PORT ?? "4022");
const chromeExecutable = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const e2eMode = process.env.BESA_E2E_MODE === "supabase" ? "supabase" : "local";
const e2eRuntime = process.env.BESA_E2E_RUNTIME === "dev" ? "dev" : "start";
const providerMode = process.env.BESA_E2E_PROVIDER_MODE === "live" ? "live" : "stub";
const shouldUseDeployStub = process.env.BESA_E2E_DEPLOY_STUB === "1";
const reuseExistingServer = process.env.BESA_E2E_REUSE_SERVER === "1";
const useExternalServer = process.env.BESA_E2E_EXTERNAL_SERVER === "1";
const outputDir = process.env.BESA_E2E_OUTPUT_DIR ?? "test-results";
const requestedHtmlReportFolder = process.env.BESA_E2E_HTML_REPORT_DIR?.trim() ?? "";
const htmlReportFolder = requestedHtmlReportFolder || "playwright-report";
const jsonReportPath = process.env.BESA_E2E_JSON_REPORT_PATH?.trim() ?? "";
const locale = process.env.BESA_E2E_LOCALE ?? process.env.BESA_E2E_SUPABASE_LOCALE ?? "en";
const storeFile = process.env.BESA_E2E_STORE_FILE ?? path.join(".data", "phase32-e2e-store.json");
const webServerEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
);
const webServerCommand =
  e2eRuntime === "dev"
    ? `npm run dev -- --hostname 127.0.0.1 --port ${port}`
    : `npm run start -- --hostname 127.0.0.1 --port ${port}`;
const webServerTimeout = e2eRuntime === "dev" ? 180_000 : 120_000;
const shouldUseProviderStub = providerMode !== "live";
const shouldUseHtmlReporter =
  process.env.CI ? true : e2eRuntime !== "start" || requestedHtmlReportFolder.length > 0;
const shouldUseSystemChrome =
  process.env.BESA_E2E_USE_SYSTEM_CHROME === "1" ||
  (!process.env.CI && e2eRuntime !== "start");
const gracefulShutdown = {
  signal: "SIGTERM" as const,
  timeout: 5_000,
};

if (e2eMode === "local") {
  webServerEnv.BESA_LOCAL_STORE_FILE = storeFile;
} else {
  delete webServerEnv.BESA_LOCAL_STORE_FILE;
}

if (shouldUseProviderStub && !webServerEnv.OPENAI_API_KEY) {
  webServerEnv.OPENAI_API_KEY = "phase42-local-provider-key";
}

if (shouldUseDeployStub && !webServerEnv.VERCEL_TOKEN) {
  webServerEnv.VERCEL_TOKEN = "phase45-local-deploy-token";
}

const webServers = [
  {
    command: webServerCommand,
    url: `http://127.0.0.1:${port}/${locale}/login`,
    timeout: webServerTimeout,
    reuseExistingServer,
    gracefulShutdown,
    env: webServerEnv,
  },
];

if (shouldUseProviderStub) {
  webServers.unshift({
    command: `node scripts/provider-e2e-stub.mjs`,
    url: `http://127.0.0.1:${providerStubPort}/healthz`,
    timeout: 60_000,
    reuseExistingServer,
    gracefulShutdown,
    env: {
      ...webServerEnv,
      BESA_E2E_PROVIDER_STUB_PORT: String(providerStubPort),
    },
  });
}

if (shouldUseDeployStub) {
  webServers.unshift({
    command: `node scripts/deploy-execution-e2e-stub.mjs`,
    url: `http://127.0.0.1:${deployStubPort}/healthz`,
    timeout: 60_000,
    reuseExistingServer,
    gracefulShutdown,
    env: {
      ...webServerEnv,
      BESA_E2E_DEPLOY_STUB_PORT: String(deployStubPort),
    },
  });
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ...(shouldUseHtmlReporter ? [["html", { open: "never", outputFolder: htmlReportFolder }] as const] : []),
    ...(jsonReportPath ? [["json", { outputFile: jsonReportPath }] as const] : []),
  ],
  outputDir,
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    launchOptions: {
      executablePath:
        shouldUseSystemChrome && existsSync(chromeExecutable) ? chromeExecutable : undefined,
    },
  },
  webServer: useExternalServer ? undefined : webServers,
});
