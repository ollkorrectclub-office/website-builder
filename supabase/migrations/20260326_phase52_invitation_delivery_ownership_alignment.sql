alter table public.workspace_invitations
  add column if not exists delivery_channel text not null default 'stored_link'
    check (delivery_channel in ('stored_link'));

alter table public.workspace_invitations
  add column if not exists delivery_attempt_number integer not null default 1
    check (delivery_attempt_number >= 1);

alter table public.workspace_invitations
  add column if not exists resent_from_invitation_id uuid references public.workspace_invitations(id) on delete set null;

alter table public.workspace_invitations
  add column if not exists last_sent_at timestamptz not null default timezone('utc', now());

alter table public.workspace_invitations
  add column if not exists expires_at timestamptz not null default (timezone('utc', now()) + interval '7 days');

create index if not exists workspace_invitations_resent_from_idx
  on public.workspace_invitations (resent_from_invitation_id);

create index if not exists workspace_invitations_expires_idx
  on public.workspace_invitations (workspace_id, expires_at desc);
