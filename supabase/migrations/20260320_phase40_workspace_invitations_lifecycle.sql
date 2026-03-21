alter table public.workspace_members
  drop constraint if exists workspace_members_status_check;

alter table public.workspace_members
  add constraint workspace_members_status_check
  check (status in ('active', 'deactivated'));

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invited_by_user_id uuid references public.profiles(id) on delete set null,
  invitee_user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invitation_token text not null unique,
  accepted_by_user_id uuid references public.profiles(id) on delete set null,
  accepted_membership_id uuid references public.workspace_members(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists workspace_invitations_workspace_idx
  on public.workspace_invitations (workspace_id, created_at desc);

create index if not exists workspace_invitations_email_idx
  on public.workspace_invitations (workspace_id, email, status);

drop trigger if exists workspace_invitations_set_updated_at on public.workspace_invitations;
create trigger workspace_invitations_set_updated_at
before update on public.workspace_invitations
for each row
execute function public.set_updated_at();

alter table public.workspace_member_events
  add column if not exists invitation_id uuid references public.workspace_invitations(id) on delete set null;

alter table public.workspace_member_events
  alter column member_user_id drop not null;

alter table public.workspace_member_events
  drop constraint if exists workspace_member_events_event_type_check;

alter table public.workspace_member_events
  add constraint workspace_member_events_event_type_check
  check (
    event_type in (
      'member_added',
      'member_role_changed',
      'invitation_created',
      'invitation_accepted',
      'member_deactivated',
      'owner_transferred'
    )
  );
