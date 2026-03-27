import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const port = Number(process.env.BESA_E2E_APP_PORT ?? "3210");
const locale = process.env.BESA_E2E_LOCALE ?? process.env.BESA_E2E_SUPABASE_LOCALE ?? "en";
const runtime = process.env.BESA_E2E_RUNTIME === "dev" ? "dev" : "start";
const providerStubPort = Number(process.env.BESA_E2E_PROVIDER_STUB_PORT ?? "3291");
const deployStubPort = Number(process.env.BESA_E2E_DEPLOY_STUB_PORT ?? "4022");
const logDir = process.env.BESA_E2E_LOG_DIR?.trim() ?? "";
const suiteArgs = process.argv.slice(2);

if (process.env.BESA_E2E_MODE !== "supabase" && !process.env.BESA_LOCAL_STORE_FILE) {
  process.env.BESA_LOCAL_STORE_FILE =
    process.env.BESA_E2E_STORE_FILE ?? path.join(".data", "phase32-e2e-store.json");
}

if (suiteArgs.length === 0) {
  console.error("Provide one or more Playwright spec paths to run.");
  process.exit(1);
}

const childProcesses = [];
let cleaningUp = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForExit(child) {
  return new Promise((resolve) => {
    child.once("exit", (code, signal) => {
      resolve({ code, signal });
    });
  });
}

async function waitForUrl(url, label, processEntry) {
  const timeoutAt = Date.now() + 120_000;

  while (Date.now() < timeoutAt) {
    if (processEntry?.child.exitCode !== null) {
      throw new Error(
        `${label} exited before becoming ready (exit code: ${processEntry.child.exitCode ?? "unknown"}).`,
      );
    }

    try {
      const response = await fetch(url, { cache: "no-store" });

      if (response.ok) {
        return;
      }
    } catch {
      // Retry until timeout.
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${label} at ${url}.`);
}

function spawnProcess(command, args, label) {
  const usePipeLogs = logDir.length > 0;
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: usePipeLogs ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (usePipeLogs) {
    const logFileName = `${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.log`;
    const logStream = createWriteStream(path.join(logDir, logFileName), {
      flags: "w",
    });

    child.stdout?.on("data", (chunk) => {
      process.stdout.write(chunk);
      logStream.write(chunk);
    });

    child.stderr?.on("data", (chunk) => {
      process.stderr.write(chunk);
      logStream.write(chunk);
    });

    child.on("exit", () => {
      logStream.end();
    });
  }

  const processEntry = {
    child,
    label,
    exitPromise: waitForExit(child),
  };

  childProcesses.push(processEntry);
  return processEntry;
}

async function cleanup() {
  if (cleaningUp) {
    return;
  }

  cleaningUp = true;

  for (const { child } of childProcesses) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  await sleep(1_500);

  for (const { child } of childProcesses) {
    if (child.exitCode === null) {
      child.kill("SIGKILL");
    }
  }

  await Promise.allSettled(childProcesses.map(({ exitPromise }) => exitPromise));
}

process.on("SIGINT", async () => {
  await cleanup();
  process.exit(130);
});

process.on("SIGTERM", async () => {
  await cleanup();
  process.exit(143);
});

try {
  if (logDir.length > 0) {
    await mkdir(logDir, { recursive: true });
  }

  if (process.env.BESA_E2E_PROVIDER_STUB === "1") {
    const providerStub = spawnProcess("node", ["scripts/provider-e2e-stub.mjs"], "provider stub");
    await waitForUrl(`http://127.0.0.1:${providerStubPort}/healthz`, "provider stub", providerStub);
  }

  if (process.env.BESA_E2E_DEPLOY_STUB === "1") {
    const deployStub = spawnProcess("node", ["scripts/deploy-execution-e2e-stub.mjs"], "deploy stub");
    await waitForUrl(`http://127.0.0.1:${deployStubPort}/healthz`, "deploy stub", deployStub);
  }

  const appArgs =
    runtime === "dev"
      ? ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)]
      : ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(port)];
  const appServer = spawnProcess("npm", appArgs, "app server");
  await waitForUrl(`http://127.0.0.1:${port}/${locale}/login`, "app server", appServer);

  const playwright = spawn(
    "npx",
    ["playwright", "test", ...suiteArgs],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BESA_E2E_EXTERNAL_SERVER: "1",
      },
      stdio: "inherit",
    },
  );

  const exitCode = await new Promise((resolve) => {
    playwright.on("exit", (code) => resolve(code ?? 1));
  });

  await cleanup();
  process.exit(Number(exitCode));
} catch (error) {
  console.error(error instanceof Error ? error.message : "E2E server harness failed.");
  await cleanup();
  process.exit(1);
}
