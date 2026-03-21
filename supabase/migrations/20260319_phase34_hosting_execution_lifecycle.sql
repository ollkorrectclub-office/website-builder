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
      'deploy_execution_rechecked',
      'deploy_execution_retried',
      'adapter_config_updated',
      'model_adapter_run',
      'preview_state'
    )
  );

alter table public.project_deploy_targets
  add column if not exists latest_execution_run_id uuid references public.project_deploy_execution_runs(id) on delete set null,
  add column if not exists latest_execution_run_status text,
  add column if not exists hosted_metadata_json jsonb;

alter table public.project_deploy_releases
  add column if not exists latest_execution_run_id uuid references public.project_deploy_execution_runs(id) on delete set null,
  add column if not exists latest_execution_status text,
  add column if not exists hosted_metadata_json jsonb;

alter table public.project_deploy_execution_runs
  add column if not exists logs_json jsonb not null default '[]'::jsonb,
  add column if not exists status_transitions_json jsonb not null default '[]'::jsonb,
  add column if not exists latest_provider_status text,
  add column if not exists last_checked_at timestamptz,
  add column if not exists retry_of_execution_run_id uuid references public.project_deploy_execution_runs(id) on delete set null,
  add column if not exists attempt_number integer not null default 1;
