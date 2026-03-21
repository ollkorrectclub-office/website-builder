import http from "node:http";

const port = Number(process.env.BESA_E2E_PROVIDER_STUB_PORT ?? "3291");

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function parseJsonBody(body) {
  try {
    return body.trim().length > 0 ? JSON.parse(body) : {};
  } catch {
    return {};
  }
}

function planningPayload() {
  return {
    summary: "External planner stub produced a launch-ready clinic plan with focused treatments and consultation flow.",
    plan: {
      productSummary: "Launch website for a dental clinic focused on consultations and treatment trust signals.",
      targetUsers: ["New patients", "Returning patients", "Families in Tirana"],
      pageMap: ["Home", "Treatments", "Pricing", "Consultation"],
      featureList: ["Consultation CTA", "Trust signals", "Pricing overview"],
      dataModels: [
        {
          name: "ConsultationInquiry",
          description: "Stores website consultation requests from prospective patients.",
        },
      ],
      authRoles: ["Admin"],
      integrationsNeeded: ["Email notifications"],
      designDirection: "Warm clinical editorial layout with high-trust CTA emphasis.",
    },
    signals: {
      requestedPageCount: 4,
      resolvedPageCount: 4,
      enabledCapabilities: ["analytics"],
      notes: "External planner stub emphasized consultation funnel clarity.",
    },
  };
}

function generationPayload() {
  return {
    summary: "External generation stub produced refined routes, theme tokens, and section copy for a consultation-led clinic site.",
    generationNotes: "External generation stub elevated the consultation CTA and treatment hierarchy.",
    themeTokens: {
      primaryColor: "#1352ff",
      secondaryColor: "#dce7ff",
      backgroundColor: "#f7f9ff",
      surfaceColor: "#ffffff",
      textColor: "#132033",
      headingFontLabel: "Space Grotesk",
      radiusScale: "rounded-xl",
      spacingScale: "spacious",
    },
    pages: [
      {
        pageKey: "home",
        title: "Home",
        slug: "home",
        sections: [
          {
            sectionKey: "hero",
            title: "Consultation-first hero",
            label: "Hero",
            isVisible: true,
            content: {
              eyebrow: "External generation",
              body: "Phase 42 generation marker for the consultation-first landing page.",
              items: ["Fast consultation requests", "Clinic trust cues"],
              ctaLabel: "Book consultation",
            },
          },
        ],
      },
      {
        pageKey: "treatments",
        title: "Treatments",
        slug: "treatments",
        sections: [
          {
            sectionKey: "overview",
            title: "Treatments overview",
            label: "Overview",
            isVisible: true,
            content: {
              eyebrow: "Treatment focus",
              body: "Highlight the clinic's most booked services with concise clinical copy.",
              items: ["Implants", "Whitening", "Checkups"],
              ctaLabel: "See treatments",
            },
          },
        ],
      },
    ],
  };
}

function patchPayload() {
  return {
    title: "External provider patch suggestion",
    rationale: "The external patch stub tightened the CTA review markers for this single file only.",
    changeSummary: "Adds a Phase 42 provider marker inside the generated file content.",
    proposedContent: "export default function Phase42ProviderPatch(){return 'phase42 provider patch marker';}\n",
    notes: "Single-file patch output from the local provider stub.",
  };
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/healthz") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method !== "POST" || request.url !== "/v1/responses") {
    sendJson(response, 404, { error: { message: "Not found" } });
    return;
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  const body = parseJsonBody(Buffer.concat(chunks).toString("utf8"));
  const capability =
    typeof body?.metadata?.capability === "string" ? body.metadata.capability : "planning";
  const payload =
    capability === "generation"
      ? generationPayload()
      : capability === "patch_suggestion"
        ? patchPayload()
        : planningPayload();

  sendJson(response, 200, {
    id: `resp_phase42_${capability}`,
    status: "completed",
    output_text: JSON.stringify(payload),
    usage: {
      input_tokens: 321,
      output_tokens: 654,
      total_tokens: 975,
    },
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Phase 42 provider stub listening on http://127.0.0.1:${port}`);
});
