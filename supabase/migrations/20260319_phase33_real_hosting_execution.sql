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
      'deploy_execution_run',
      'adapter_config_updated',
      'model_adapter_run',
      'preview_state'
    )
  );

create table if not exists public.project_deploy_execution_runs (
  id uuid primary key,
  deploy_target_id uuid not null references public.project_deploy_targets(id) on delete cascade,
  deploy_run_id uuid not null references public.project_deploy_runs(id) on delete cascade,
  release_id uuid not null references public.project_deploy_releases(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  requested_adapter_preset_key text not null check (
    requested_adapter_preset_key in ('custom', 'vercel_nextjs', 'netlify_static', 'container_node')
  ),
  requested_adapter_key text not null check (
    requested_adapter_key in (
      'static_snapshot_v1',
      'vercel_deploy_api_v1',
      'netlify_bundle_handoff_v1',
      'container_release_handoff_v1'
    )
  ),
  actual_adapter_key text not null check (
    actual_adapter_key in ('vercel_deploy_api_v1', 'unsupported_hosting_adapter_v1')
  ),
  provider_key text check (provider_key in ('vercel')),
  provider_label text,
  status text not null check (status in ('blocked', 'submitted', 'ready', 'failed')),
  summary text not null,
  readiness_summary_json jsonb not null default '{}'::jsonb,
  provider_response_json jsonb,
  hosted_url text,
  hosted_inspection_url text,
  provider_deployment_id text,
  primary_domain text not null default '',
  environment_key text not null default '',
  error_message text,
  started_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_project_deploy_execution_runs_project
  on public.project_deploy_execution_runs (project_id, started_at desc);

create index if not exists idx_project_deploy_execution_runs_release
  on public.project_deploy_execution_runs (release_id, started_at desc);
