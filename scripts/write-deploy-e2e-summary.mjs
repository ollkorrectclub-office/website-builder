import { appendFile } from "node:fs/promises";

function value(key) {
  return process.env[key]?.trim() ?? "";
}

function formatLink(label, url) {
  if (!label) {
    return "_not configured_";
  }

  if (!url) {
    return `\`${label}\``;
  }

  return `[${label}](${url})`;
}

const summaryPath = value("GITHUB_STEP_SUMMARY");

if (!summaryPath) {
  console.log("GITHUB_STEP_SUMMARY is not set. Skipping deploy CI summary output.");
  process.exit(0);
}

const jobLabel = value("BESA_CI_JOB_LABEL") || "Deploy execution verification";
const verificationCommand = value("BESA_CI_VERIFICATION_COMMAND") || "n/a";
const jobStatus = value("BESA_CI_JOB_STATUS") || "unknown";
const secretGated = value("BESA_CI_SECRET_GATED") === "1";
const reportArtifact = formatLink(
  value("BESA_CI_REPORT_ARTIFACT_NAME"),
  value("BESA_CI_REPORT_ARTIFACT_URL"),
);
const resultsArtifact = formatLink(
  value("BESA_CI_TEST_RESULTS_ARTIFACT_NAME"),
  value("BESA_CI_TEST_RESULTS_ARTIFACT_URL"),
);
const logsArtifact = formatLink(
  value("BESA_CI_LOG_ARTIFACT_NAME"),
  value("BESA_CI_LOG_ARTIFACT_URL"),
);
const reportPath = value("BESA_CI_REPORT_PATH");
const resultsPath = value("BESA_CI_TEST_RESULTS_PATH");
const logsPath = value("BESA_CI_LOG_PATH");

const lines = [
  `## ${jobLabel}`,
  "",
  `- Job status: \`${jobStatus}\``,
  `- Verification command: \`${verificationCommand}\``,
  `- Secret-gated job: ${secretGated ? "yes" : "no"}`,
  `- Playwright report artifact: ${reportArtifact}`,
  `- Test-results artifact: ${resultsArtifact}`,
  `- Wrapper/server logs artifact: ${logsArtifact}`,
];

if (reportPath || resultsPath || logsPath) {
  lines.push("", "Artifact paths inside the job workspace:");

  if (reportPath) {
    lines.push(`- Playwright report path: \`${reportPath}\``);
  }

  if (resultsPath) {
    lines.push(`- Test-results path: \`${resultsPath}\``);
  }

  if (logsPath) {
    lines.push(`- Wrapper/server logs path: \`${logsPath}\``);
  }
}

lines.push("");

await appendFile(summaryPath, `${lines.join("\n")}\n`, "utf8");
