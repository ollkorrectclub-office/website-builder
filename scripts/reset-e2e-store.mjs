import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const fixtureFile = process.env.BESA_E2E_STORE_FIXTURE ?? "local-store-baseline.json";
const sourceFile = path.join(root, "e2e", "fixtures", fixtureFile);
const targetFile = path.join(
  root,
  process.env.BESA_E2E_STORE_FILE ?? path.join(".data", "phase32-e2e-store.json"),
);

if (process.env.BESA_E2E_MODE === "supabase") {
  process.exit(0);
}

await mkdir(path.dirname(targetFile), { recursive: true });
await cp(sourceFile, targetFile);
