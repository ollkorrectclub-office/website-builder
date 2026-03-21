import type { Locale } from "@/lib/i18n/locales";
import type {
  Country,
  PlanRevisionState,
  ProjectStatus,
  ProjectType,
  WorkspaceInvitationStatus,
  WorkspaceMemberStatus,
  WorkspaceRole,
} from "@/lib/workspaces/types";

export const countryOptions: Array<{ value: Country; label: Record<Locale, string> }> = [
  {
    value: "kosovo",
    label: {
      sq: "Kosovë",
      en: "Kosovo",
    },
  },
  {
    value: "albania",
    label: {
      sq: "Shqipëri",
      en: "Albania",
    },
  },
];

export const projectTypeOptions: Array<{ value: ProjectType; label: Record<Locale, string> }> = [
  { value: "website", label: { sq: "Website", en: "Website" } },
  { value: "dashboard", label: { sq: "Dashboard", en: "Dashboard" } },
  { value: "marketplace", label: { sq: "Marketplace", en: "Marketplace" } },
  { value: "crm", label: { sq: "CRM", en: "CRM" } },
  { value: "booking_app", label: { sq: "Aplikacion rezervimesh", en: "Booking app" } },
  { value: "internal_tool", label: { sq: "Mjet i brendshëm", en: "Internal tool" } },
  { value: "ecommerce", label: { sq: "E-commerce", en: "E-commerce" } },
  { value: "ai_assistant", label: { sq: "Asistent AI", en: "AI assistant" } },
];

export const designStyleOptions: Array<{ value: string; label: Record<Locale, string> }> = [
  { value: "premium-minimal", label: { sq: "Premium minimal", en: "Premium minimal" } },
  { value: "editorial-clean", label: { sq: "Editorial clean", en: "Editorial clean" } },
  { value: "corporate-serious", label: { sq: "Corporate serious", en: "Corporate serious" } },
  { value: "warm-hospitality", label: { sq: "Warm hospitality", en: "Warm hospitality" } },
  { value: "modern-utility", label: { sq: "Modern utility", en: "Modern utility" } },
];

export const capabilityOptions: Array<{
  key: keyof {
    auth: boolean;
    payments: boolean;
    cms: boolean;
    fileUpload: boolean;
    aiChat: boolean;
    calendar: boolean;
    analytics: boolean;
  };
  label: Record<Locale, string>;
}> = [
  { key: "auth", label: { sq: "Autentikim", en: "Authentication" } },
  { key: "payments", label: { sq: "Pagesa", en: "Payments" } },
  { key: "cms", label: { sq: "CMS", en: "CMS" } },
  { key: "fileUpload", label: { sq: "Ngarkim skedarësh", en: "File upload" } },
  { key: "aiChat", label: { sq: "AI chat", en: "AI chat" } },
  { key: "calendar", label: { sq: "Kalendar", en: "Calendar" } },
  { key: "analytics", label: { sq: "Analytics", en: "Analytics" } },
];

export const statusLabels: Record<ProjectStatus, Record<Locale, string>> = {
  draft: { sq: "Draft", en: "Draft" },
  intake_submitted: { sq: "Intake dërguar", en: "Intake submitted" },
  plan_ready: { sq: "Plani gati", en: "Plan ready" },
  plan_in_review: { sq: "Në review", en: "In review" },
  plan_approved: { sq: "Plani aprovuar", en: "Plan approved" },
  archived: { sq: "Arkivuar", en: "Archived" },
};

export const revisionStateLabels: Record<PlanRevisionState, Record<Locale, string>> = {
  generated: { sq: "Gjeneruar", en: "Generated" },
  draft_saved: { sq: "Draft ruajtur", en: "Draft saved" },
  needs_changes: { sq: "Kërkon ndryshime", en: "Needs changes" },
  approved: { sq: "Aprovuar", en: "Approved" },
};

export const workspaceRoleLabels: Record<WorkspaceRole, Record<Locale, string>> = {
  owner: { sq: "Owner", en: "Owner" },
  admin: { sq: "Admin", en: "Admin" },
  editor: { sq: "Editor", en: "Editor" },
  viewer: { sq: "Viewer", en: "Viewer" },
};

export const workspaceMemberStatusLabels: Record<WorkspaceMemberStatus, Record<Locale, string>> = {
  active: { sq: "Aktiv", en: "Active" },
  deactivated: { sq: "Çaktivizuar", en: "Deactivated" },
};

export const workspaceInvitationStatusLabels: Record<WorkspaceInvitationStatus, Record<Locale, string>> = {
  pending: { sq: "Në pritje", en: "Pending" },
  accepted: { sq: "Pranuar", en: "Accepted" },
  revoked: { sq: "Revokuar", en: "Revoked" },
};
