create table if not exists public.project_deploy_targets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null default '',
  target_type text not null check (target_type in ('internal_snapshot_v1')),
  status text not null check (status in ('idle', 'snapshot_ready', 'failed')),
  latest_deploy_run_id uuid,
  latest_deploy_run_status text check (latest_deploy_run_status in ('completed', 'failed')),
  latest_plan_revision_id uuid references public.project_plan_revisions(id) on delete set null,
  latest_plan_revision_number integer,
  latest_visual_revision_number integer,
  latest_code_revision_number integer,
  latest_generation_run_id uuid references public.project_generation_runs(id) on delete set null,
  latest_runtime_source text check (latest_runtime_source in ('accepted_generation_target', 'visual_fallback')),
  latest_summary text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id)
);

create index if not exists project_deploy_targets_workspace_idx
  on public.project_deploy_targets (workspace_id, project_id);

drop trigger if exists project_deploy_targets_set_updated_at on public.project_deploy_targets;
create trigger project_deploy_targets_set_updated_at
before update on public.project_deploy_targets
for each row
execute function public.set_updated_at();

create table if not exists public.project_deploy_runs (
  id uuid primary key default gen_random_uuid(),
  deploy_target_id uuid not null references public.project_deploy_targets(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_plan_revision_id uuid not null references public.project_plan_revisions(id) on delete cascade,
  source_plan_revision_number integer not null,
  source_plan_snapshot jsonb not null,
  source_visual_revision_number integer not null,
  source_code_revision_number integer not null,
  source_generation_run_id uuid references public.project_generation_runs(id) on delete set null,
  runtime_source text not null check (runtime_source in ('accepted_generation_target', 'visual_fallback')),
  source text not null check (source in ('deterministic_deployer_v1')),
  trigger text not null check (trigger in ('publish_requested')),
  status text not null check (status in ('completed', 'failed')),
  summary text not null default '',
  output_summary jsonb,
  error_message text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists project_deploy_runs_project_idx
  on public.project_deploy_runs (project_id, started_at desc);

drop trigger if exists project_deploy_runs_set_updated_at on public.project_deploy_runs;
create trigger project_deploy_runs_set_updated_at
before update on public.project_deploy_runs
for each row
execute function public.set_updated_at();

create table if not exists public.project_deploy_artifacts (
  id uuid primary key default gen_random_uuid(),
  deploy_run_id uuid not null references public.project_deploy_runs(id) on delete cascade,
  deploy_target_id uuid not null references public.project_deploy_targets(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  artifact_type text not null check (
    artifact_type in (
      'deploy_snapshot_manifest',
      'deploy_route_bundle',
      'deploy_theme_bundle',
      'deploy_output_package'
    )
  ),
  label text not null default '',
  payload_json jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists project_deploy_artifacts_project_idx
  on public.project_deploy_artifacts (project_id, created_at desc);

alter table public.project_audit_timeline_events
  drop constraint if exists project_audit_timeline_events_kind_check;

alter table public.project_audit_timeline_events
  add constraint project_audit_timeline_events_kind_check
  check (
    kind in (
      'planner_run',
      'generation_run',
      'refresh_queue_created',
      'brief_updated',
      'plan_revision',
      'plan_candidate_promoted',
      'refresh_queue_deferred',
      'refresh_queue_stale',
      'refresh_queue_completed',
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
      'deploy_run',
      'preview_state'
    )
  );
