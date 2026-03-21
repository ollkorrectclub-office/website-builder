import type { ReactNode } from "react";

import { requireAuthenticatedUserOrRedirect } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

export default async function AuthenticatedAppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAuthenticatedUserOrRedirect(locale, `/${locale}/app/workspaces`);

  return children;
}
