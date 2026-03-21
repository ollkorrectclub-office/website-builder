"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { initialFormState } from "@/lib/workspaces/form-state";
import type { FormState } from "@/lib/workspaces/form-state";
import {
  workspaceInvitationStatusLabels,
  workspaceMemberStatusLabels,
  workspaceRoleLabels,
} from "@/lib/workspaces/options";
import type {
  WorkspaceInvitationRecord,
  WorkspaceMemberDirectoryEntryRecord,
  WorkspaceMemberEventRecord,
  WorkspaceMemberManagementBundle,
  WorkspaceRole,
} from "@/lib/workspaces/types";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

type MemberAction = (state: FormState, formData: FormData) => Promise<FormState>;

function fieldClass() {
  return "w-full rounded-[18px] border border-border bg-background/70 px-4 py-3 text-sm text-card-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";
}

function MemberActionButton({
  label,
  pendingLabel,
  disabled,
  testId,
  variant = "primary",
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  testId?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} disabled={disabled || pending} data-testid={testId}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function countByRole(members: WorkspaceMemberDirectoryEntryRecord[], role: WorkspaceRole) {
  return members.filter((member) => member.status === "active" && member.role === role).length;
}

function countByStatus(
  members: WorkspaceMemberDirectoryEntryRecord[],
  status: WorkspaceMemberDirectoryEntryRecord["status"],
) {
  return members.filter((member) => member.status === status).length;
}

function lifecycleEventLabel(locale: Locale, dictionary: Dictionary, event: WorkspaceMemberEventRecord) {
  switch (event.eventType) {
    case "member_added":
      return locale === "sq"
        ? `${event.memberName} u shtua si ${workspaceRoleLabels[event.nextRole][locale]}`
        : `${event.memberName} was added as ${workspaceRoleLabels[event.nextRole][locale]}`;
    case "member_role_changed": {
      const previousRole = event.previousRole ? workspaceRoleLabels[event.previousRole][locale] : null;
      const nextRole = workspaceRoleLabels[event.nextRole][locale];

      return locale === "sq"
        ? `${event.memberName} kaloi nga ${previousRole ?? dictionary.dashboard.members.activityUnknownRole} në ${nextRole}`
        : `${event.memberName} moved from ${previousRole ?? dictionary.dashboard.members.activityUnknownRole} to ${nextRole}`;
    }
    case "invitation_created":
      return locale === "sq"
        ? `U krijua ftesë për ${event.memberEmail} si ${workspaceRoleLabels[event.nextRole][locale]}`
        : `An invitation was created for ${event.memberEmail} as ${workspaceRoleLabels[event.nextRole][locale]}`;
    case "invitation_accepted":
      return locale === "sq"
        ? `${event.memberName} e pranoi ftesën si ${workspaceRoleLabels[event.nextRole][locale]}`
        : `${event.memberName} accepted the invitation as ${workspaceRoleLabels[event.nextRole][locale]}`;
    case "member_deactivated":
      return locale === "sq"
        ? `${event.memberName} u çaktivizua nga workspace-i`
        : `${event.memberName} was deactivated from the workspace`;
    case "owner_transferred":
      return locale === "sq"
        ? `Ownership-i u transferua te ${event.memberName}`
        : `Ownership was transferred to ${event.memberName}`;
  }
}

function eventTone(eventType: WorkspaceMemberEventRecord["eventType"]) {
  switch (eventType) {
    case "owner_transferred":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    case "member_deactivated":
      return "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
    case "invitation_created":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";
    case "invitation_accepted":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
    default:
      return "bg-primary/10 text-primary";
  }
}

function eventLabel(locale: Locale, eventType: WorkspaceMemberEventRecord["eventType"]) {
  switch (eventType) {
    case "member_added":
      return locale === "sq" ? "Shtuar" : "Added";
    case "member_role_changed":
      return locale === "sq" ? "Rol" : "Role";
    case "invitation_created":
      return locale === "sq" ? "Ftesë" : "Invite";
    case "invitation_accepted":
      return locale === "sq" ? "Pranim" : "Accepted";
    case "member_deactivated":
      return locale === "sq" ? "Çaktivizuar" : "Deactivated";
    case "owner_transferred":
      return locale === "sq" ? "Transferim owner" : "Owner transfer";
  }
}

function MemberLifecycleRow({
  locale,
  dictionary,
  member,
  canManage,
  isCurrentUser,
  updateRoleAction,
  deactivateMemberAction,
}: {
  locale: Locale;
  dictionary: Dictionary;
  member: WorkspaceMemberDirectoryEntryRecord;
  canManage: boolean;
  isCurrentUser: boolean;
  updateRoleAction: MemberAction;
  deactivateMemberAction: MemberAction;
}) {
  const [roleState, roleFormAction] = useActionState(updateRoleAction, initialFormState);
  const [deactivateState, deactivateFormAction] = useActionState(deactivateMemberAction, initialFormState);
  const ownerLocked = member.role === "owner";
  const inactive = member.status !== "active";
  const canEditRole = canManage && !ownerLocked && !inactive;
  const canDeactivate = canManage && !ownerLocked && !inactive && !isCurrentUser;

  return (
    <div className="rounded-[20px] border border-border bg-background/70 p-4" data-testid={`workspace-member-row-${member.membershipId}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-card-foreground">{member.fullName}</p>
            {isCurrentUser ? <Badge>{dictionary.dashboard.members.currentUserBadge}</Badge> : null}
            <Badge>{workspaceRoleLabels[member.role][locale]}</Badge>
            <Badge className="bg-card/80">{workspaceMemberStatusLabels[member.status][locale]}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{member.email}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {dictionary.dashboard.members.joinedAt}: {formatDateTimeLabel(member.joinedAt, locale)}
          </p>
          {inactive ? (
            <p className="mt-3 text-xs text-muted-foreground">{dictionary.dashboard.members.deactivateHint}</p>
          ) : null}
        </div>

        <div className="w-full max-w-xl space-y-3 xl:w-[360px]">
          <form action={roleFormAction} className="space-y-3">
            <input type="hidden" name="membershipId" value={member.membershipId} />
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select
                name="role"
                defaultValue={member.role}
                className={fieldClass()}
                disabled={!canEditRole}
                data-testid={`workspace-member-role-${member.membershipId}`}
              >
                <option value="admin">{workspaceRoleLabels.admin[locale]}</option>
                <option value="editor">{workspaceRoleLabels.editor[locale]}</option>
                <option value="viewer">{workspaceRoleLabels.viewer[locale]}</option>
              </select>
              <MemberActionButton
                label={dictionary.dashboard.members.saveRole}
                pendingLabel={dictionary.dashboard.members.savingRole}
                disabled={!canEditRole}
                testId={`workspace-member-save-${member.membershipId}`}
              />
            </div>
            {roleState.message ? (
              <p className={`text-xs ${roleState.status === "error" ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                {roleState.message}
              </p>
            ) : null}
          </form>

          <form action={deactivateFormAction} className="space-y-2">
            <input type="hidden" name="membershipId" value={member.membershipId} />
            <MemberActionButton
              label={dictionary.dashboard.members.deactivateAction}
              pendingLabel={dictionary.dashboard.members.deactivatingAction}
              disabled={!canDeactivate}
              variant="secondary"
              testId={`workspace-member-deactivate-${member.membershipId}`}
            />
            {!canDeactivate && !inactive ? (
              <p className="text-xs text-muted-foreground">
                {ownerLocked
                  ? dictionary.dashboard.members.ownerLockedCopy
                  : isCurrentUser
                    ? dictionary.dashboard.members.deactivateSelfCopy
                    : dictionary.dashboard.members.readOnlyCopy}
              </p>
            ) : null}
            {deactivateState.message ? (
              <p className={`text-xs ${deactivateState.status === "error" ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                {deactivateState.message}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}

function InvitationRow({
  locale,
  dictionary,
  invitation,
}: {
  locale: Locale;
  dictionary: Dictionary;
  invitation: WorkspaceInvitationRecord;
}) {
  const inviteHref = `/${locale}/invite/${invitation.invitationToken}`;

  return (
    <div className="rounded-[18px] border border-border bg-card/70 px-4 py-4" data-testid={`workspace-invitation-row-${invitation.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{workspaceRoleLabels[invitation.role][locale]}</Badge>
        <Badge className="bg-card/80">{workspaceInvitationStatusLabels[invitation.status][locale]}</Badge>
      </div>
      <p className="mt-3 text-sm font-semibold text-card-foreground">{invitation.email}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {formatDateTimeLabel(invitation.createdAt, locale)}
      </p>
      {invitation.acceptedAt ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {dictionary.dashboard.members.inviteAcceptedAt}: {formatDateTimeLabel(invitation.acceptedAt, locale)}
        </p>
      ) : null}
      {invitation.status === "pending" ? (
        <div className="mt-4">
          <Link
            href={inviteHref}
            className="text-sm font-semibold text-primary transition hover:text-primary/80"
            data-testid={`workspace-invitation-link-${invitation.id}`}
          >
            {dictionary.dashboard.members.inviteOpenAction}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function OwnerTransferCard({
  locale,
  dictionary,
  bundle,
  transferOwnerAction,
}: {
  locale: Locale;
  dictionary: Dictionary;
  bundle: WorkspaceMemberManagementBundle;
  transferOwnerAction: MemberAction;
}) {
  const [state, formAction] = useActionState(transferOwnerAction, initialFormState);
  const canTransfer = bundle.membership.role === "owner";
  const eligibleMembers = bundle.members.filter(
    (member) => member.status === "active" && member.role !== "owner",
  );

  return (
    <Card className="border-border bg-background/70 px-5 py-5 shadow-none">
      <p className="text-sm font-semibold text-card-foreground">{dictionary.dashboard.members.transferTitle}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{dictionary.dashboard.members.transferCopy}</p>

      <form action={formAction} className="mt-5 space-y-4" data-testid="workspace-owner-transfer-form">
        <label className="block space-y-2 text-sm">
          <span className="text-muted-foreground">{dictionary.dashboard.members.transferTargetLabel}</span>
          <select
            name="targetMembershipId"
            defaultValue=""
            className={fieldClass()}
            disabled={!canTransfer}
          >
            <option value="">{dictionary.dashboard.members.transferSelectPlaceholder}</option>
            {eligibleMembers.map((member) => (
              <option key={member.membershipId} value={member.membershipId}>
                {member.fullName} · {workspaceRoleLabels[member.role][locale]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm">
          <span className="text-muted-foreground">{dictionary.dashboard.members.transferConfirmationLabel}</span>
          <input
            name="confirmation"
            placeholder={bundle.workspace.slug}
            className={fieldClass()}
            disabled={!canTransfer}
          />
          <p className="text-xs text-muted-foreground">{dictionary.dashboard.members.transferConfirmationHint}</p>
        </label>
        <MemberActionButton
          label={dictionary.dashboard.members.transferAction}
          pendingLabel={dictionary.dashboard.members.transferringAction}
          disabled={!canTransfer || eligibleMembers.length === 0}
          testId="workspace-owner-transfer-submit"
        />
        {state.message ? (
          <p className={`text-sm ${state.status === "error" ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
            {state.message}
          </p>
        ) : null}
        {!canTransfer ? (
          <p className="text-sm leading-6 text-muted-foreground">{dictionary.dashboard.members.transferReadOnlyCopy}</p>
        ) : null}
      </form>
    </Card>
  );
}

export function WorkspaceMembersCard({
  locale,
  dictionary,
  bundle,
  inviteMemberAction,
  updateRoleAction,
  deactivateMemberAction,
  transferOwnerAction,
}: {
  locale: Locale;
  dictionary: Dictionary;
  bundle: WorkspaceMemberManagementBundle;
  inviteMemberAction: MemberAction;
  updateRoleAction: MemberAction;
  deactivateMemberAction: MemberAction;
  transferOwnerAction: MemberAction;
}) {
  const [inviteState, inviteFormAction] = useActionState(inviteMemberAction, initialFormState);
  const canManageMembers = bundle.permissions.canManageWorkspace;
  const activeMembers = countByStatus(bundle.members, "active");
  const deactivatedMembers = countByStatus(bundle.members, "deactivated");
  const pendingInvitations = bundle.invitations.filter((invitation) => invitation.status === "pending").length;

  return (
    <div className="space-y-6">
      <Card id="workspace-members" className="px-6 py-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.dashboard.members.eyebrow}
            </p>
            <h3 className="mt-2 font-display text-2xl font-bold text-card-foreground">
              {dictionary.dashboard.members.title}
            </h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {dictionary.dashboard.members.copy}
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 xl:max-w-[420px] xl:grid-cols-4">
            <div className="rounded-[20px] border border-border bg-background/70 px-4 py-4 text-center">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{dictionary.dashboard.members.activeMembers}</p>
              <p className="mt-2 text-lg font-semibold text-card-foreground">{activeMembers}</p>
            </div>
            <div className="rounded-[20px] border border-border bg-background/70 px-4 py-4 text-center">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{dictionary.dashboard.members.pendingInvites}</p>
              <p className="mt-2 text-lg font-semibold text-card-foreground">{pendingInvitations}</p>
            </div>
            <div className="rounded-[20px] border border-border bg-background/70 px-4 py-4 text-center">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{dictionary.dashboard.members.deactivatedMembers}</p>
              <p className="mt-2 text-lg font-semibold text-card-foreground">{deactivatedMembers}</p>
            </div>
            <div className="rounded-[20px] border border-border bg-background/70 px-4 py-4 text-center">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {workspaceRoleLabels.owner[locale]} / {workspaceRoleLabels.admin[locale]}
              </p>
              <p className="mt-2 text-lg font-semibold text-card-foreground">
                {countByRole(bundle.members, "owner") + countByRole(bundle.members, "admin")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
          <div className="space-y-4">
            {bundle.members.map((member) => (
              <MemberLifecycleRow
                key={member.membershipId}
                locale={locale}
                dictionary={dictionary}
                member={member}
                canManage={canManageMembers}
                isCurrentUser={member.userId === bundle.currentUser.id}
                updateRoleAction={updateRoleAction}
                deactivateMemberAction={deactivateMemberAction}
              />
            ))}
          </div>

          <div className="space-y-6">
            <Card className="border-border bg-background/70 px-5 py-5 shadow-none">
              <p className="text-sm font-semibold text-card-foreground">{dictionary.dashboard.members.addTitle}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{dictionary.dashboard.members.addCopy}</p>

              <form action={inviteFormAction} className="mt-5 space-y-4" data-testid="workspace-invitation-create-form">
                <label className="block space-y-2 text-sm">
                  <span className="text-muted-foreground">{dictionary.dashboard.members.emailLabel}</span>
                  <input name="email" type="email" className={fieldClass()} disabled={!canManageMembers} />
                </label>
                <label className="block space-y-2 text-sm">
                  <span className="text-muted-foreground">{dictionary.dashboard.members.roleLabel}</span>
                  <select name="role" defaultValue="viewer" className={fieldClass()} disabled={!canManageMembers}>
                    <option value="admin">{workspaceRoleLabels.admin[locale]}</option>
                    <option value="editor">{workspaceRoleLabels.editor[locale]}</option>
                    <option value="viewer">{workspaceRoleLabels.viewer[locale]}</option>
                  </select>
                </label>
                <p className="text-xs text-muted-foreground">{dictionary.dashboard.members.inviteHint}</p>
                <MemberActionButton
                  label={dictionary.dashboard.members.addAction}
                  pendingLabel={dictionary.dashboard.members.addingAction}
                  disabled={!canManageMembers}
                  testId="workspace-invitation-create-submit"
                />
                {inviteState.message ? (
                  <p className={`text-sm ${inviteState.status === "error" ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                    {inviteState.message}
                  </p>
                ) : null}
                {!canManageMembers ? (
                  <p className="text-sm leading-6 text-muted-foreground">{dictionary.dashboard.members.readOnlyCopy}</p>
                ) : null}
              </form>
            </Card>

            <Card className="border-border bg-background/70 px-5 py-5 shadow-none">
              <p className="text-sm font-semibold text-card-foreground">{dictionary.dashboard.members.invitationsTitle}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{dictionary.dashboard.members.invitationsCopy}</p>
              <div className="mt-4 space-y-3">
                {bundle.invitations.length > 0 ? (
                  bundle.invitations.slice(0, 6).map((invitation) => (
                    <InvitationRow
                      key={invitation.id}
                      locale={locale}
                      dictionary={dictionary}
                      invitation={invitation}
                    />
                  ))
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">{dictionary.dashboard.members.noInvitations}</p>
                )}
              </div>
            </Card>

            <OwnerTransferCard
              locale={locale}
              dictionary={dictionary}
              bundle={bundle}
              transferOwnerAction={transferOwnerAction}
            />

            <Card className="border-border bg-background/70 px-5 py-5 shadow-none">
              <p className="text-sm font-semibold text-card-foreground">{dictionary.dashboard.members.activityTitle}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{dictionary.dashboard.members.activityCopy}</p>
              <div className="mt-4 space-y-3">
                {bundle.events.length > 0 ? (
                  bundle.events.slice(0, 10).map((event) => (
                    <div key={event.id} className="rounded-[18px] border border-border bg-card/70 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={eventTone(event.eventType)}>{eventLabel(locale, event.eventType)}</Badge>
                        <Badge className="bg-card/80">{workspaceRoleLabels[event.nextRole][locale]}</Badge>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-card-foreground">
                        {lifecycleEventLabel(locale, dictionary, event)}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {event.actorLabel} · {formatDateTimeLabel(event.occurredAt, locale)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">{dictionary.dashboard.members.noActivity}</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
}
