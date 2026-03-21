import type { Locale } from "@/lib/i18n/locales";
import type {
  CreateProjectInput,
  ProjectCapabilities,
  ProjectType,
  StructuredPlan,
} from "@/lib/workspaces/types";

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function splitList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultPages(projectType: ProjectType) {
  switch (projectType) {
    case "website":
      return ["Home", "Services", "About", "Contact"];
    case "dashboard":
      return ["Overview", "Reports", "Users", "Settings"];
    case "marketplace":
      return ["Home", "Listings", "Seller profile", "Checkout"];
    case "crm":
      return ["Pipeline", "Contacts", "Deals", "Activity"];
    case "booking_app":
      return ["Home", "Availability", "Booking flow", "My bookings"];
    case "internal_tool":
      return ["Overview", "Tasks", "Operations", "Settings"];
    case "ecommerce":
      return ["Home", "Catalog", "Product detail", "Cart", "Checkout"];
    case "ai_assistant":
      return ["Landing", "Assistant", "Knowledge", "Settings"];
  }
}

function dataModelsForType(projectType: ProjectType) {
  switch (projectType) {
    case "website":
      return [
        { name: "Lead", description: "Captures inbound interest and contact requests." },
        { name: "Content block", description: "Stores page content and reusable sections." },
      ];
    case "dashboard":
      return [
        { name: "User", description: "Represents internal operators and access levels." },
        { name: "Report", description: "Stores dashboard KPIs and reporting snapshots." },
      ];
    case "marketplace":
      return [
        { name: "Listing", description: "Core inventory or service item shown in the marketplace." },
        { name: "Inquiry", description: "Buyer lead or transaction initiation." },
      ];
    case "crm":
      return [
        { name: "Contact", description: "Lead or customer profile record." },
        { name: "Deal", description: "Sales opportunity and pipeline stage." },
      ];
    case "booking_app":
      return [
        { name: "Booking", description: "Reservation record with availability and status." },
        { name: "Service", description: "Bookable offering, slot, or resource." },
      ];
    case "internal_tool":
      return [
        { name: "Task", description: "Internal work item and assignee state." },
        { name: "Workflow", description: "Operational step logic or checklist." },
      ];
    case "ecommerce":
      return [
        { name: "Product", description: "Catalog item with stock, price, and media." },
        { name: "Order", description: "Purchase record and fulfillment state." },
      ];
    case "ai_assistant":
      return [
        { name: "Conversation", description: "User chat session and message history." },
        { name: "Knowledge item", description: "Structured source used by the assistant." },
      ];
  }
}

function integrationsForCapabilities(capabilities: ProjectCapabilities) {
  const integrations: string[] = [];

  if (capabilities.auth) integrations.push("Supabase Auth");
  if (capabilities.payments) integrations.push("Payments provider placeholder");
  if (capabilities.cms) integrations.push("CMS content model");
  if (capabilities.fileUpload) integrations.push("Supabase Storage");
  if (capabilities.aiChat) integrations.push("AI provider placeholder");
  if (capabilities.calendar) integrations.push("Calendar sync placeholder");
  if (capabilities.analytics) integrations.push("Analytics event tracking");

  return integrations.length > 0 ? integrations : ["Standard contact and lead capture"];
}

function authRoles(capabilities: ProjectCapabilities) {
  if (!capabilities.auth) {
    return ["Public visitor"];
  }

  return ["Workspace admin", "Editor", "Reviewer"];
}

function describeLocales(locales: Locale[]) {
  return locales
    .map((locale) => (locale === "sq" ? "Albanian" : "English"))
    .join(" and ");
}

export function buildMockStructuredPlan(
  input: Pick<
    CreateProjectInput,
    | "name"
    | "prompt"
    | "projectType"
    | "targetUsers"
    | "desiredPagesFeatures"
    | "designStyle"
    | "supportedLocales"
    | "country"
    | "businessCategory"
    | "capabilities"
  >,
) {
  const requestedPages = input.desiredPagesFeatures.filter(Boolean);
  const pages = requestedPages.length > 0 ? requestedPages : defaultPages(input.projectType);
  const targetUsers = splitList(input.targetUsers);
  const features = [
    `${titleCase(input.projectType)} foundation`,
    ...requestedPages.map((item) => item),
    ...integrationsForCapabilities(input.capabilities),
  ];

  const locationNote = input.country === "kosovo" ? "Kosovo market" : "Albania market";

  return {
    productSummary:
      input.prompt.trim() ||
      `${input.name} is a ${titleCase(input.projectType).toLowerCase()} for the ${input.businessCategory} sector with a ${input.designStyle} direction.`,
    targetUsers:
      targetUsers.length > 0 ? targetUsers : [`Primary buyers in the ${input.businessCategory} category`],
    pageMap: pages,
    featureList: Array.from(new Set(features)),
    dataModels: dataModelsForType(input.projectType),
    authRoles: authRoles(input.capabilities),
    integrationsNeeded: integrationsForCapabilities(input.capabilities),
    designDirection: `${titleCase(input.designStyle)} visual direction tailored for ${locationNote} with ${describeLocales(input.supportedLocales)} output.`,
  } satisfies StructuredPlan;
}
