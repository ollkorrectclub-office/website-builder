import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type ProofCheckStatus = "passed" | "failed" | "not_applicable";

export interface ProofCheckRecord {
  status: ProofCheckStatus;
  details: string;
}

interface ProofSummaryRecord {
  shapeCheck?: ProofCheckRecord;
  fallbackCheck?: ProofCheckRecord;
  nonDestructiveCheck?: ProofCheckRecord;
}

function proofSummaryPath() {
  const configured = process.env.BESA_E2E_PROOF_SUMMARY_PATH?.trim();

  return configured && configured.length > 0 ? configured : null;
}

async function readProofSummary(path: string) {
  try {
    return JSON.parse(await readFile(path, "utf8")) as ProofSummaryRecord;
  } catch {
    return {};
  }
}

export async function resetProofSummary() {
  const path = proofSummaryPath();

  if (!path) {
    return;
  }

  await rm(path, { force: true });
}

export async function recordProofCheck(
  key: keyof ProofSummaryRecord,
  status: ProofCheckStatus,
  details: string,
) {
  const path = proofSummaryPath();

  if (!path) {
    return;
  }

  const existing = await readProofSummary(path);
  existing[key] = {
    status,
    details,
  };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
}
