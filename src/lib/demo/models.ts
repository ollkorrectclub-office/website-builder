import type { Locale } from "@/lib/i18n/locales";

export type MarketScope = "kosovo" | "albania" | "regional";
export type WorkspaceRole = "owner" | "admin" | "editor" | "reviewer";
export type ProjectStage =
  | "brief-approved"
  | "structure-ready"
  | "content-review"
  | "onboarding";

export interface WorkspaceMember {
  id: string;
  name: string;
  role: WorkspaceRole;
  locale: Locale;
  focus: string;
}

export interface WorkspaceActivity {
  id: string;
  title: string;
  detail: string;
  timeLabel: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  done: boolean;
  description: string;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  sector: string;
  stage: ProjectStage;
  summary: string;
  owner: string;
  locales: Locale[];
  updatedAtLabel: string;
  goals: string[];
  pages: string[];
  checklist: string[];
}

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  marketScope: MarketScope;
  defaultLocale: Locale;
  supportedLocales: Locale[];
  planLabel: string;
  readinessScore: number;
  nextStep: string;
  pipelineLabel: string;
  members: WorkspaceMember[];
  onboarding: OnboardingStep[];
  projects: Project[];
  activity: WorkspaceActivity[];
}
