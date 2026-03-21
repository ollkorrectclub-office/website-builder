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
      'deploy_target_updated',
      'deploy_release_promoted',
      'deploy_release_handoff_prepared',
      'deploy_release_exported',
      'deploy_handoff_run',
      'preview_state'
    )
  );

create table if not exists public.project_deploy_handoff_runs (
  id uuid primary key,
  deploy_target_id uuid not null,
  deploy_run_id uuid not null,
  release_id uuid not null,
  workspace_id uuid not null,
  project_id uuid not null,
  source text not null,
  adapter_preset_key text not null,
  adapter_key text not null,
  status text not null check (status in ('blocked', 'completed', 'failed')),
  summary text not null,
  readiness_summary_json jsonb not null default '{}'::jsonb,
  logs_json jsonb not null default '[]'::jsonb,
  primary_domain text not null default '',
  environment_key text not null default '',
  export_file_name text,
  started_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_project_deploy_handoff_runs_project
  on public.project_deploy_handoff_runs (project_id, started_at desc);

create index if not exists idx_project_deploy_handoff_runs_release
  on public.project_deploy_handoff_runs (release_id, started_at desc);
