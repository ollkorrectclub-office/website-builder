create table if not exists public.project_generation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_plan_revision_id uuid not null references public.project_plan_revisions(id) on delete cascade,
  source_plan_revision_number integer not null,
  source_plan_snapshot jsonb not null,
  source text not null check (source in ('deterministic_generator_v1')),
  trigger text not null check (trigger in ('plan_approved')),
  status text not null check (status in ('completed', 'failed')),
  summary text not null default '',
  output_summary jsonb,
  error_message text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists project_generation_runs_project_idx
  on public.project_generation_runs (project_id, started_at desc);

drop trigger if exists project_generation_runs_set_updated_at on public.project_generation_runs;
create trigger project_generation_runs_set_updated_at
before update on public.project_generation_runs
for each row
execute function public.set_updated_at();

create table if not exists public.project_generation_artifacts (
  id uuid primary key default gen_random_uuid(),
  generation_run_id uuid not null references public.project_generation_runs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  artifact_type text not null check (
    artifact_type in (
      'visual_scaffold_target',
      'code_scaffold_target',
      'theme_token_target',
      'route_page_target'
    )
  ),
  label text not null default '',
  payload_json jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists project_generation_artifacts_project_idx
  on public.project_generation_artifacts (project_id, created_at desc);

alter table public.project_builder_refresh_queue_items
  add column if not exists generation_run_id uuid references public.project_generation_runs(id) on delete set null;

alter table public.project_builder_refresh_queue_items
  drop constraint if exists project_builder_refresh_queue_items_reason_check;

alter table public.project_builder_refresh_queue_items
  add constraint project_builder_refresh_queue_items_reason_check
  check (reason in ('plan_promotion', 'generation_run'));

alter table public.project_audit_timeline_events
  drop constraint if exists project_audit_timeline_events_kind_check;

alter table public.project_audit_timeline_events
  add constraint project_audit_timeline_events_kind_check
  check (
    kind in (
      'planner_run',
      'generation_run',
      'brief_updated',
      'plan_revision',
      'plan_candidate_promoted',
      'refresh_queue_deferred',
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
      'preview_state'
    )
  );
