import type { ModelAdapterExecutionRecord, ModelAdapterTraceRecord } from "@/lib/model-adapters/types";
import type { CodePatchProposalSource, ProjectCodeFileRecord } from "@/lib/builder/types";

export interface CodePatchSuggestionInput {
  file: Pick<ProjectCodeFileRecord, "path" | "name" | "kind" | "language">;
  currentContent: string;
  requestPrompt: string;
}

export interface GeneratedCodePatchSuggestion {
  title: string;
  rationale: string;
  changeSummary: string;
  proposedContent: string;
  source: CodePatchProposalSource;
}

export interface CodePatchSuggestionServiceResult {
  suggestion: GeneratedCodePatchSuggestion;
  adapterExecution: ModelAdapterExecutionRecord;
}

export interface PatchSuggestionAdapter {
  readonly source: CodePatchProposalSource;
  suggest(input: CodePatchSuggestionInput): Promise<GeneratedCodePatchSuggestion>;
}

export interface ExternalPatchSuggestionExecutionDetails {
  latencyMs: number;
  trace: ModelAdapterTraceRecord;
}

export interface ExternalPatchSuggestionAdapterConfig {
  providerKey: "openai_compatible" | "custom_http";
  providerLabel: string;
  modelName: string;
  endpointUrl: string | null;
  apiKeyEnvVar: string;
}

export interface ExternalPatchSuggestionExecutionAdapter {
  readonly source: "external_patch_adapter_v1";
  suggest(
    input: CodePatchSuggestionInput,
  ): Promise<{ suggestion: GeneratedCodePatchSuggestion; execution: ExternalPatchSuggestionExecutionDetails }>;
}

export interface ExternalPatchSuggestionAdapterFactory {
  create(config: ExternalPatchSuggestionAdapterConfig): ExternalPatchSuggestionExecutionAdapter;
}

export interface CodePatchSuggestionService {
  generateSuggestion(input: CodePatchSuggestionInput): Promise<CodePatchSuggestionServiceResult>;
}

export interface CodePatchSuggestionServiceDependencies {
  deterministicAdapter: PatchSuggestionAdapter;
  externalAdapterFactory: ExternalPatchSuggestionAdapterFactory;
}
