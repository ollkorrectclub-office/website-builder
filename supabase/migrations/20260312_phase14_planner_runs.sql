alter table public.projects
  alter column planner_source set default 'rules_planner_v1';

alter table public.project_plan_revisions
  alter column planner_source set default 'rules_planner_v1';

create table if not exists public.project_planner_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null check (source in ('mock_planner', 'rules_planner_v1')),
  trigger text not null check (trigger in ('project_create', 'project_rerun')),
  status text not null check (status in ('completed', 'failed')),
  summary text not null default '',
  input_snapshot jsonb not null default '{}'::jsonb,
  output_plan jsonb,
  generated_plan_revision_id uuid references public.project_plan_revisions(id) on delete set null,
  generated_plan_revision_number integer,
  error_message text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_planner_artifacts (
  id uuid primary key default gen_random_uuid(),
  planner_run_id uuid not null references public.project_planner_runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('normalized_brief', 'planning_signals', 'plan_payload')),
  label text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists project_planner_runs_project_idx
  on public.project_planner_runs (project_id, started_at desc);

create index if not exists project_planner_artifacts_project_idx
  on public.project_planner_artifacts (project_id, created_at desc);

drop trigger if exists project_planner_runs_set_updated_at on public.project_planner_runs;
create trigger project_planner_runs_set_updated_at
before update on public.project_planner_runs
for each row
execute function public.set_updated_at();

alter table public.project_audit_timeline_events
  drop constraint if exists project_audit_timeline_events_kind_check;

alter table public.project_audit_timeline_events
  add constraint project_audit_timeline_events_kind_check
  check (
    kind in (
      'planner_run',
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
