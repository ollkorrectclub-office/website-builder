import type { Workspace } from "@/lib/demo/models";

export const demoWorkspace: Workspace = {
  id: "ws_demo_besa",
  slug: "besa-studio",
  name: "Besa Studio",
  marketScope: "regional",
  defaultLocale: "sq",
  supportedLocales: ["sq", "en"],
  planLabel: "Private beta",
  readinessScore: 78,
  nextStep: "Finalize the first workspace brief and move one project into visual editing.",
  pipelineLabel: "6 serious inbound opportunities across clinics, legal, and hospitality",
  members: [
    {
      id: "mem_arta",
      name: "Arta Kelmendi",
      role: "owner",
      locale: "sq",
      focus: "Go-to-market and partner delivery",
    },
    {
      id: "mem_leon",
      name: "Leon Dema",
      role: "admin",
      locale: "en",
      focus: "Product operations and launch structure",
    },
    {
      id: "mem_nora",
      name: "Nora Qorri",
      role: "editor",
      locale: "sq",
      focus: "Copy, content QA, and onboarding",
    },
  ],
  onboarding: [
    {
      id: "brand",
      title: "Workspace identity approved",
      done: true,
      description: "Name, market scope, supported locales, and visual direction are in place.",
    },
    {
      id: "brief",
      title: "First structured brief reviewed",
      done: true,
      description: "The first brief is shaped around a premium dental clinic use case.",
    },
    {
      id: "team",
      title: "Team roles confirmed",
      done: false,
      description: "Add one reviewer role for the first client-side approval flow.",
    },
  ],
  projects: [
    {
      id: "proj_denta",
      slug: "denta-plus-tirana",
      name: "Denta Plus Tirana",
      sector: "Dental clinic",
      stage: "structure-ready",
      summary:
        "A bilingual clinic website with service pages, WhatsApp CTA, consultation booking, and trust-led messaging.",
      owner: "Arta Kelmendi",
      locales: ["sq", "en"],
      updatedAtLabel: "Today, 11:10",
      goals: [
        "Increase consultation bookings from mobile traffic",
        "Present treatments clearly in Albanian and English",
        "Create a more premium first impression than local competitors",
      ],
      pages: ["Home", "Treatments", "Offers", "About the clinic", "Book consultation"],
      checklist: [
        "Confirm primary treatment categories",
        "Lock bilingual navigation structure",
        "Approve first trust block direction",
      ],
    },
    {
      id: "proj_lex",
      slug: "lex-prishtina",
      name: "Lex Prishtina",
      sector: "Law firm",
      stage: "brief-approved",
      summary:
        "A serious legal practice website centered on authority, expertise, and first consultation capture.",
      owner: "Leon Dema",
      locales: ["sq", "en"],
      updatedAtLabel: "Today, 09:35",
      goals: [
        "Improve trust signals for business law services",
        "Clarify practice areas for corporate clients",
        "Generate consultation leads without looking generic",
      ],
      pages: ["Home", "Practice areas", "Team", "Insights", "Contact"],
      checklist: [
        "Approve tone of voice",
        "Select hero messaging direction",
        "Map service categories by practice area",
      ],
    },
    {
      id: "proj_rruga",
      slug: "rruga-e-shijes",
      name: "Rruga e Shijes",
      sector: "Restaurant group",
      stage: "onboarding",
      summary:
        "A restaurant website focused on menu visibility, reservations, local discovery, and seasonal offers.",
      owner: "Nora Qorri",
      locales: ["sq", "en"],
      updatedAtLabel: "Yesterday",
      goals: [
        "Increase direct table reservations",
        "Make seasonal offers easier to promote",
        "Support bilingual visitors during peak tourism months",
      ],
      pages: ["Home", "Menu", "Private events", "Gallery", "Reservations"],
      checklist: [
        "Confirm reservation contact method",
        "Select image direction",
        "Define menu publishing workflow",
      ],
    },
  ],
  activity: [
    {
      id: "act_1",
      title: "Workspace profile approved",
      detail: "Regional scope was set to Kosovo + Albania with Albanian and English enabled.",
      timeLabel: "11:02",
    },
    {
      id: "act_2",
      title: "Denta Plus moved into structure-ready",
      detail: "Core page list and consultation funnel were accepted by the team.",
      timeLabel: "10:41",
    },
    {
      id: "act_3",
      title: "Lex Prishtina brief refined",
      detail: "The legal positioning shifted toward corporate advisory and dispute support.",
      timeLabel: "09:14",
    },
  ],
};

export function getDemoWorkspaceBySlug(slug: string) {
  return demoWorkspace.slug === slug ? demoWorkspace : null;
}

export function getDemoProject(workspaceSlug: string, projectSlug: string) {
  const workspace = getDemoWorkspaceBySlug(workspaceSlug);

  if (!workspace) {
    return null;
  }

  return workspace.projects.find((project) => project.slug === projectSlug) ?? null;
}
