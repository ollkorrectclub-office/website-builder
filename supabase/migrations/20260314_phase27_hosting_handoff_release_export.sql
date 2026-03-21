alter table public.project_deploy_releases
  drop constraint if exists project_deploy_releases_status_check;

alter table public.project_deploy_releases
  add constraint project_deploy_releases_status_check
  check (status in ('promoted', 'handoff_ready', 'exported'));

alter table public.project_deploy_releases
  add column if not exists handoff_payload_json jsonb,
  add column if not exists export_snapshot_json jsonb,
  add column if not exists export_file_name text,
  add column if not exists handoff_prepared_at timestamptz,
  add column if not exists exported_at timestamptz;

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
      'preview_state'
    )
  );
