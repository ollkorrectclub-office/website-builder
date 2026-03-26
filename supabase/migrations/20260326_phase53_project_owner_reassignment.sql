alter table public.workspace_member_events
  add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.workspace_member_events
  drop constraint if exists workspace_member_events_event_type_check;

alter table public.workspace_member_events
  add constraint workspace_member_events_event_type_check
  check (
    event_type in (
      'member_added',
      'member_role_changed',
      'invitation_created',
      'invitation_accepted',
      'invitation_revoked',
      'invitation_resent',
      'member_deactivated',
      'member_reactivated',
      'owner_transferred',
      'project_owner_reassigned'
    )
  );

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
      'preview_state',
      'project_owner_reassigned'
    )
  );
