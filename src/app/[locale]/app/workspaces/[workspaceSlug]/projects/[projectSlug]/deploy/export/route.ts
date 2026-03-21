import { NextResponse } from "next/server";

import { assertProjectPermission } from "@/lib/auth/access";
import {
  exportProjectDeployReleaseSnapshot,
  getProjectDeployBundle,
} from "@/lib/deploy/repository";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ locale: string; workspaceSlug: string; projectSlug: string }>;
  },
) {
  const { workspaceSlug, projectSlug } = await context.params;
  const formData = await request.formData();
  const releaseId = String(formData.get("releaseId") ?? "").trim();

  if (!releaseId) {
    return NextResponse.json({ error: "Release id is required." }, { status: 400 });
  }

  const bundle = await getProjectDeployBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    return NextResponse.json({ error: "Project deploy context not found." }, { status: 404 });
  }

  try {
    assertProjectPermission(
      bundle.projectPermissions,
      "canPublishDeploy",
      "You do not have permission to export release snapshots for this project.",
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Access denied." },
      { status: 403 },
    );
  }

  const release = bundle.releases.find((entry) => entry.id === releaseId) ?? null;

  if (!release) {
    return NextResponse.json({ error: "Deploy release not found." }, { status: 404 });
  }

  try {
    const exported = await exportProjectDeployReleaseSnapshot({ releaseId });

    return new NextResponse(exported.content, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exported.fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Release export could not be generated.",
      },
      { status: 400 },
    );
  }
}
