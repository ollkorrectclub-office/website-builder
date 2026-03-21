alter table public.projects
  drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check
  check (status in ('draft', 'intake_submitted', 'plan_ready', 'plan_in_review', 'plan_approved', 'archived'));

alter table public.projects
  add column if not exists current_plan_revision_id uuid,
  add column if not exists current_plan_revision_number integer not null default 1,
  add column if not exists plan_last_updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists planner_source text not null default 'mock_planner';

create table if not exists public.project_plan_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  revision_number integer not null,
  state text not null check (state in ('generated', 'draft_saved', 'needs_changes', 'approved')),
  edited_section text not null,
  change_summary text not null default '',
  planner_source text not null default 'mock_planner',
  plan_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (project_id, revision_number)
);

insert into public.project_plan_revisions (
  project_id,
  revision_number,
  state,
  edited_section,
  change_summary,
  planner_source,
  plan_payload,
  created_at
)
select
  projects.id,
  1,
  'generated',
  'status',
  'Initial plan revision backfilled from existing project data.',
  coalesce(projects.planner_source, 'mock_planner'),
  projects.structured_plan,
  coalesce(projects.updated_at, projects.created_at)
from public.projects
where not exists (
  select 1
  from public.project_plan_revisions
  where project_plan_revisions.project_id = projects.id
);

update public.projects as projects
set
  current_plan_revision_id = revisions.id,
  current_plan_revision_number = revisions.revision_number,
  plan_last_updated_at = revisions.created_at,
  planner_source = coalesce(projects.planner_source, 'mock_planner')
from public.project_plan_revisions as revisions
where revisions.project_id = projects.id
  and revisions.revision_number = 1
  and projects.current_plan_revision_id is null;
