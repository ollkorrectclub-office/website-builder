alter table public.project_audit_timeline_events
  drop constraint if exists project_audit_timeline_events_source_check;

alter table public.project_audit_timeline_events
  add constraint project_audit_timeline_events_source_check
  check (source in ('plan', 'visual', 'code', 'preview', 'deploy'));
