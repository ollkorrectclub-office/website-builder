create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  company_name text not null default '',
  password_hash text not null,
  auth_provider text not null default 'password',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_token text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null
);

alter table public.workspaces
  add column if not exists owner_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists created_by_user_id uuid references public.profiles(id) on delete set null;

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  status text not null default 'active' check (status in ('active')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, user_id)
);

alter table public.projects
  add column if not exists owner_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists created_by_user_id uuid references public.profiles(id) on delete set null;

alter table public.project_audit_timeline_events
  add column if not exists actor_user_id uuid references public.profiles(id) on delete set null;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists workspace_members_set_updated_at on public.workspace_members;
create trigger workspace_members_set_updated_at
before update on public.workspace_members
for each row
execute function public.set_updated_at();
