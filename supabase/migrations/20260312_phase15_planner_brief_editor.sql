create table if not exists public.project_briefs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  prompt text not null default '',
  project_type text not null,
  target_users text not null,
  desired_pages_features text[] not null default array[]::text[],
  design_style text not null,
  primary_locale text not null check (primary_locale in ('sq', 'en')),
  supported_locales text[] not null default array['sq']::text[],
  country text not null check (country in ('kosovo', 'albania')),
  business_category text not null,
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists project_briefs_project_idx
  on public.project_briefs (project_id);

drop trigger if exists project_briefs_set_updated_at on public.project_briefs;
create trigger project_briefs_set_updated_at
before update on public.project_briefs
for each row
execute function public.set_updated_at();

insert into public.project_briefs (
  project_id,
  workspace_id,
  name,
  prompt,
  project_type,
  target_users,
  desired_pages_features,
  design_style,
  primary_locale,
  supported_locales,
  country,
  business_category,
  capabilities,
  created_at,
  updated_at
)
select
  projects.id,
  projects.workspace_id,
  projects.name,
  coalesce(projects.prompt, ''),
  projects.project_type,
  projects.target_users,
  projects.desired_pages_features,
  projects.design_style,
  projects.primary_locale,
  coalesce(
    (
      select array_agg(value)
      from jsonb_array_elements_text(projects.intake_payload -> 'supportedLocales') as value
    ),
    array[projects.primary_locale]
  ),
  projects.country,
  projects.business_category,
  projects.capabilities,
  projects.created_at,
  projects.updated_at
from public.projects
on conflict (project_id) do nothing;

alter table public.project_planner_runs
  add column if not exists brief_id uuid references public.project_briefs(id) on delete set null,
  add column if not exists brief_updated_at timestamptz;

update public.project_planner_runs as runs
set
  brief_id = briefs.id,
  brief_updated_at = coalesce(runs.brief_updated_at, briefs.updated_at)
from public.project_briefs as briefs
where briefs.project_id = runs.project_id
  and runs.brief_id is null;

alter table public.project_audit_timeline_events
  drop constraint if exists project_audit_timeline_events_kind_check;

alter table public.project_audit_timeline_events
  add constraint project_audit_timeline_events_kind_check
  check (
    kind in (
      'planner_run',
      'brief_updated',
      'plan_revision',
      'visual_scaffold',
      'visual_section_updated',
      'visual_section_reordered',
      'visual_theme_updated',
      'code_revision',
      'code_restore',
      'code_refresh',
      'proposal_applied',
      'proposal_rejected',
      'proposal_stale',
      'proposal_archived',
      'preview_state'
    )
  );
