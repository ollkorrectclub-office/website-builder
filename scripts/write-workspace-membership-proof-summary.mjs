import { appendFile, readFile } from "node:fs/promises";

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

function statusLabel(status) {
  switch (status) {
    case "success":
      return "PASSED";
    case "failure":
      return "FAILED";
    case "cancelled":
      return "CANCELLED";
    default:
      return status.toUpperCase();
  }
}

function fallbackCounts() {
  return {
    passed: 0,
    failed: 0,
    skipped: 0,
    flaky: 0,
  };
}

function summarizeFromSuites(suites) {
  const counts = fallbackCounts();
  const stack = [...suites];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current) {
      continue;
    }

    if (Array.isArray(current.suites)) {
      stack.push(...current.suites);
    }

    if (!Array.isArray(current.specs)) {
      continue;
    }

    for (const spec of current.specs) {
      for (const test of spec.tests ?? []) {
        const results = Array.isArray(test.results) ? test.results : [];
        const finalResult = [...results].reverse().find((entry) => typeof entry?.status === "string");
        const status = finalResult?.status ?? "unknown";

        switch (status) {
          case "passed":
            counts.passed += 1;
            break;
          case "skipped":
            counts.skipped += 1;
            break;
          case "flaky":
            counts.flaky += 1;
            break;
          default:
            counts.failed += 1;
            break;
        }
      }
    }
  }

  return counts;
}

async function readPlaywrightCounts(jsonReportPath) {
  if (!jsonReportPath) {
    return null;
  }

  try {
    const report = JSON.parse(await readFile(jsonReportPath, "utf8"));

    if (report?.stats) {
      return {
        passed: Number(report.stats.expected ?? 0),
        failed: Number(report.stats.unexpected ?? 0),
        skipped: Number(report.stats.skipped ?? 0),
        flaky: Number(report.stats.flaky ?? 0),
      };
    }

    if (Array.isArray(report?.suites)) {
      return summarizeFromSuites(report.suites);
    }
  } catch (error) {
    return {
      ...fallbackCounts(),
      readError: error instanceof Error ? error.message : "Unable to parse Playwright JSON report.",
    };
  }

  return fallbackCounts();
}

const summaryPath = value("GITHUB_STEP_SUMMARY");

if (!summaryPath) {
  console.log("GITHUB_STEP_SUMMARY is not set. Skipping workspace membership proof summary output.");
  process.exit(0);
}

const jobLabel = value("BESA_CI_JOB_LABEL") || "Workspace membership proof";
const jobVariant = value("BESA_CI_JOB_VARIANT");
const verificationCommand = value("BESA_CI_VERIFICATION_COMMAND") || "n/a";
const jobStatus = value("BESA_CI_JOB_STATUS") || "unknown";
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
const counts = await readPlaywrightCounts(value("BESA_CI_JSON_REPORT_PATH"));
const summaryLabel = counts
  ? `${counts.passed} passed, ${counts.failed} failed, ${counts.skipped} skipped, ${counts.flaky} flaky`
  : "_unavailable_";

const lines = [
  `## ${jobLabel}`,
  "",
  `- Result: **${statusLabel(jobStatus)}**`,
];

if (jobVariant) {
  lines.push(`- Workflow variant: \`${jobVariant}\``);
}

lines.push(`- Raw job status: \`${jobStatus}\``);
lines.push(`- Verification command: \`${verificationCommand}\``);
lines.push(`- Test summary: **${summaryLabel}**`);
lines.push("");
lines.push("### Artifacts");
lines.push(`- Playwright report: ${reportArtifact}`);
lines.push(`- Test-results download: ${resultsArtifact}`);
lines.push(`- Wrapper/server logs: ${logsArtifact}`);

if (counts?.readError) {
  lines.push(`- JSON summary parse note: ${counts.readError}`);
}

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
