create table if not exists public.workspace_member_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  membership_id uuid references public.workspace_members(id) on delete set null,
  member_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_label text not null,
  event_type text not null check (event_type in ('member_added', 'member_role_changed')),
  member_email text not null,
  member_name text not null,
  previous_role text check (previous_role in ('owner', 'admin', 'editor', 'viewer')),
  next_role text not null check (next_role in ('owner', 'admin', 'editor', 'viewer')),
  summary text not null,
  occurred_at timestamptz not null default timezone('utc', now())
);

create index if not exists workspace_member_events_workspace_idx
  on public.workspace_member_events (workspace_id, occurred_at desc);
