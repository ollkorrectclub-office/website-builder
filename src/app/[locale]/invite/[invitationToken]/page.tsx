import { notFound } from "next/navigation";

import { WorkspaceInvitationAcceptCard } from "@/components/dashboard/workspace-invitation-accept-card";
import { logoutAction } from "@/lib/auth/actions";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { workspaceRoleLabels } from "@/lib/workspaces/options";
import { acceptWorkspaceInvitationAction } from "@/lib/workspaces/actions";
import { getWorkspaceInvitationAcceptanceBundle } from "@/lib/workspaces/repository";
import { getWorkspaceInvitationDisplayStatus } from "@/lib/workspaces/utils";

export default async function WorkspaceInvitationPage({
  params,
}: {
  params: Promise<{ locale: string; invitationToken: string }>;
}) {
  const { locale, invitationToken } = await params;
  const dictionary = getDictionary(locale);
  const bundle = await getWorkspaceInvitationAcceptanceBundle(invitationToken);

  if (!bundle) {
    notFound();
  }

  const inviteHref = `/${locale}/invite/${invitationToken}`;
  const invitationDisplayStatus = getWorkspaceInvitationDisplayStatus(bundle.invitation);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,153,255,0.08),_transparent_45%),linear-gradient(180deg,#f7f9fc_0%,#eef3f9_100%)] px-4 py-12 dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_40%),linear-gradient(180deg,#09111b_0%,#0f1723_100%)]">
      <WorkspaceInvitationAcceptCard
        locale={locale as Locale}
        dictionary={dictionary}
        workspaceName={bundle.workspace.name}
        workspaceHref={`/${locale}/app/workspaces/${bundle.workspace.slug}`}
        loginHref={`/${locale}/login?next=${encodeURIComponent(inviteHref)}`}
        invitationEmail={bundle.invitation.email}
        roleLabel={workspaceRoleLabels[bundle.invitation.role][locale as Locale]}
        invitationDisplayStatus={invitationDisplayStatus}
        invitationLastSentAt={bundle.invitation.lastSentAt}
        invitationExpiresAt={bundle.invitation.expiresAt}
        deliveryChannel={bundle.invitation.deliveryChannel}
        deliveryAttemptNumber={bundle.invitation.deliveryAttemptNumber}
        hasExistingAccount={Boolean(bundle.existingUser)}
        currentUserEmail={bundle.currentUser?.email ?? null}
        acceptAction={acceptWorkspaceInvitationAction.bind(null, locale, invitationToken)}
        logoutAction={logoutAction.bind(null, locale)}
      />
    </main>
  );
}
