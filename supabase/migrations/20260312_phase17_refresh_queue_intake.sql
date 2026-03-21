alter table public.project_builder_refresh_queue_items
  drop constraint if exists project_builder_refresh_queue_items_status_check;

alter table public.project_builder_refresh_queue_items
  add constraint project_builder_refresh_queue_items_status_check
  check (status in ('pending', 'deferred', 'completed'));

alter table public.project_builder_refresh_queue_items
  add column if not exists deferred_at timestamptz,
  add column if not exists defer_reason text;

alter table public.project_audit_timeline_events
  drop constraint if exists project_audit_timeline_events_kind_check;

alter table public.project_audit_timeline_events
  add constraint project_audit_timeline_events_kind_check
  check (
    kind in (
      'planner_run',
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
