import type { Locale } from "@/lib/i18n/locales";
import type { CodeFileKind, CodeFileOwnership, VisualSectionType } from "@/lib/builder/types";

export const visualSectionTypeLabels: Record<VisualSectionType, Record<Locale, string>> = {
  hero: { sq: "Hero", en: "Hero" },
  features: { sq: "Features", en: "Features" },
  testimonials: { sq: "Testimonials", en: "Testimonials" },
  pricing: { sq: "Pricing", en: "Pricing" },
  faq: { sq: "FAQ", en: "FAQ" },
  contact: { sq: "Contact", en: "Contact" },
  navbar: { sq: "Navbar", en: "Navbar" },
  footer: { sq: "Footer", en: "Footer" },
  custom_generic: { sq: "Content block", en: "Content block" },
};

export const codeFileKindLabels: Record<CodeFileKind, Record<Locale, string>> = {
  route: { sq: "Route", en: "Route" },
  component: { sq: "Component", en: "Component" },
  config: { sq: "Config", en: "Config" },
  style: { sq: "Styles", en: "Styles" },
  data: { sq: "Data", en: "Data" },
  integration: { sq: "Integration", en: "Integration" },
};

export const codeFileOwnershipLabels: Record<CodeFileOwnership, Record<Locale, string>> = {
  visual_owned: { sq: "Visual-owned", en: "Visual-owned" },
  scaffold_owned: { sq: "Scaffold-owned", en: "Scaffold-owned" },
};
