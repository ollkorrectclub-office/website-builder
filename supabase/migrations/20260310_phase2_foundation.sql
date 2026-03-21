create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  business_category text not null,
  country text not null check (country in ('kosovo', 'albania')),
  default_locale text not null check (default_locale in ('sq', 'en')),
  supported_locales text[] not null default array['sq']::text[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workspace_onboarding (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  company_name text not null,
  intent_notes text,
  onboarding_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slug text not null,
  name text not null,
  starting_mode text not null check (starting_mode in ('prompt', 'wizard')),
  status text not null check (status in ('draft', 'intake_submitted', 'plan_ready', 'archived')),
  project_type text not null,
  prompt text,
  target_users text not null,
  desired_pages_features text[] not null default array[]::text[],
  design_style text not null,
  primary_locale text not null check (primary_locale in ('sq', 'en')),
  country text not null check (country in ('kosovo', 'albania')),
  business_category text not null,
  capabilities jsonb not null default '{}'::jsonb,
  intake_payload jsonb not null default '{}'::jsonb,
  structured_plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, slug)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
before update on public.workspaces
for each row
execute function public.set_updated_at();

drop trigger if exists workspace_onboarding_set_updated_at on public.workspace_onboarding;
create trigger workspace_onboarding_set_updated_at
before update on public.workspace_onboarding
for each row
execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();
