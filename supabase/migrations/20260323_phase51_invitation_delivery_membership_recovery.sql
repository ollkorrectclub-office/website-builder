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
      'owner_transferred'
    )
  );
