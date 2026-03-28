import type {
  CodePatchSuggestionInput,
  GeneratedCodePatchSuggestion,
  PatchSuggestionAdapter,
} from "@/lib/builder/code-patch-types";
import type { ProjectCodeFileRecord } from "@/lib/builder/types";

function sanitizePrompt(prompt: string) {
  return prompt.replace(/\s+/g, " ").trim();
}

function shortPrompt(prompt: string, limit = 72) {
  const cleaned = sanitizePrompt(prompt);

  if (cleaned.length <= limit) {
    return cleaned;
  }

  return `${cleaned.slice(0, limit - 1).trimEnd()}…`;
}

function slugifyPrompt(prompt: string) {
  const normalized = sanitizePrompt(prompt)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.slice(0, 40) || "builder-review";
}

function escapeForStringLiteral(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function insertAfterImports(content: string, snippet: string) {
  const matches = [...content.matchAll(/^import .*;\n?/gm)];

  if (matches.length === 0) {
    return `${snippet}${content}`;
  }

  const last = matches.at(-1);

  if (!last || typeof last.index !== "number") {
    return `${snippet}${content}`;
  }

  const insertAt = last.index + last[0].length;

  return `${content.slice(0, insertAt)}\n${snippet}${content.slice(insertAt)}`;
}

function insertBeforeFirstExportOrReturn(content: string, snippet: string) {
  const exportIndex = content.search(/\nexport (default )?function /);

  if (exportIndex !== -1) {
    return `${content.slice(0, exportIndex + 1)}${snippet}\n${content.slice(exportIndex + 1)}`;
  }

  const returnIndex = content.indexOf("\n  return (");

  if (returnIndex !== -1) {
    return `${content.slice(0, returnIndex + 1)}${snippet}\n${content.slice(returnIndex + 1)}`;
  }

  return `${snippet}\n${content}`;
}

function appendLineComment(content: string, prompt: string) {
  const comment = `// Controlled patch suggestion: ${sanitizePrompt(prompt)}`;

  if (content.includes(comment)) {
    return content;
  }

  return insertBeforeFirstExportOrReturn(content, comment);
}

function appendCommentBlock(content: string, prompt: string, language: ProjectCodeFileRecord["language"]) {
  if (language === "css") {
    const comment = `/* Controlled patch suggestion: ${sanitizePrompt(prompt)} */`;

    return content.includes(comment) ? content : `${content.trimEnd()}\n\n${comment}\n`;
  }

  return appendLineComment(content, prompt);
}

function addRootDataAttribute(content: string, prompt: string) {
  const marker = slugifyPrompt(prompt);

  if (content.includes(`data-builder-intent="${marker}"`)) {
    return content;
  }

  if (content.includes("<main ")) {
    return content.replace("<main ", `<main data-builder-intent="${marker}" `);
  }

  if (content.includes("<section ")) {
    return content.replace("<section ", `<section data-builder-intent="${marker}" `);
  }

  return content;
}

function addMetadataExport(content: string, file: CodePatchSuggestionInput["file"], prompt: string) {
  if (content.includes("export const metadata")) {
    return content;
  }

  const title = file.name === "page.tsx" ? "Project page review" : file.name.replace(/\.tsx?$/, "");
  const promptSummary = escapeForStringLiteral(shortPrompt(prompt, 56));
  const snippet =
    `export const metadata = {\n` +
    `  title: "${escapeForStringLiteral(title)}",\n` +
    `  description: "${promptSummary}",\n` +
    `} as const;\n`;

  return insertAfterImports(content, snippet);
}

function addIntegrationEntry(content: string, prompt: string) {
  const normalized = sanitizePrompt(prompt).toLowerCase();
  let label = "Workflow review placeholder";

  if (normalized.includes("whatsapp")) {
    label = "WhatsApp lead routing";
  } else if (normalized.includes("email")) {
    label = "Email capture workflow";
  } else if (normalized.includes("analytics")) {
    label = "GA4 analytics placeholder";
  } else if (normalized.includes("calendar")) {
    label = "Appointment sync placeholder";
  } else if (normalized.includes("payment")) {
    label = "Payment confirmation placeholder";
  }

  if (content.includes(`"${label}"`)) {
    return content;
  }

  const anchor = "] as const;";

  if (!content.includes(anchor)) {
    return appendCommentBlock(content, prompt, "ts");
  }

  return content.replace(anchor, `  "${label}",\n${anchor}`);
}

function buildProposedContent(input: CodePatchSuggestionInput) {
  const normalizedPrompt = sanitizePrompt(input.requestPrompt).toLowerCase();
  let proposed = input.currentContent;

  if (input.file.kind === "route" && /seo|metadata|title|search/.test(normalizedPrompt)) {
    proposed = addMetadataExport(proposed, input.file, input.requestPrompt);
  }

  if (input.file.path === "lib/integrations.ts") {
    proposed = addIntegrationEntry(proposed, input.requestPrompt);
  }

  proposed = addRootDataAttribute(proposed, input.requestPrompt);
  proposed = appendCommentBlock(proposed, input.requestPrompt, input.file.language);

  if (proposed === input.currentContent) {
    proposed = `${input.currentContent.trimEnd()}\n\n// Controlled patch suggestion: ${sanitizePrompt(input.requestPrompt)}\n`;
  }

  return proposed;
}

export function generateMockCodePatchSuggestion(
  input: CodePatchSuggestionInput,
): GeneratedCodePatchSuggestion {
  const promptLabel = shortPrompt(input.requestPrompt, 64);

  return {
    title: `Refine ${input.file.name} for ${promptLabel}`,
    rationale: `This proposal stays inside ${input.file.path} so it can be reviewed under the current scaffold ownership and sync guardrails.`,
    changeSummary: `Apply controlled patch suggestion: ${promptLabel}`,
    proposedContent: buildProposedContent(input),
    source: "mock_assistant",
  };
}

export class MockCodePatchSuggestionAdapter implements PatchSuggestionAdapter {
  readonly source = "mock_assistant" as const;

  async suggest(input: CodePatchSuggestionInput): Promise<GeneratedCodePatchSuggestion> {
    return generateMockCodePatchSuggestion(input);
  }
}
