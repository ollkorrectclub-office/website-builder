import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const nextDir = path.join(root, ".next");
const nextServerDir = path.join(nextDir, "server");
const nextStaticDir = path.join(nextDir, "static");

await rm(nextDir, {
  recursive: true,
  force: true,
  maxRetries: 8,
  retryDelay: 150,
});
await mkdir(nextServerDir, { recursive: true });
await mkdir(nextStaticDir, { recursive: true });
await writeFile(path.join(nextServerDir, "pages-manifest.json"), "{}\n", "utf-8");
await writeFile(path.join(nextServerDir, "middleware-manifest.json"), "{}\n", "utf-8");
