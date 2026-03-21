create table if not exists public.project_builder_refresh_queue_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  surface text not null check (surface in ('visual', 'code')),
  status text not null check (status in ('pending', 'completed')),
  reason text not null check (reason in ('plan_promotion')),
  target_plan_revision_id uuid references public.project_plan_revisions(id) on delete set null,
  target_plan_revision_number integer not null,
  pinned_plan_revision_number integer,
  requires_manual_review boolean not null default false,
  summary text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create index if not exists project_builder_refresh_queue_items_project_idx
  on public.project_builder_refresh_queue_items (project_id, created_at desc);

create index if not exists project_builder_refresh_queue_items_project_surface_idx
  on public.project_builder_refresh_queue_items (project_id, surface, status, created_at desc);

drop trigger if exists project_builder_refresh_queue_items_set_updated_at on public.project_builder_refresh_queue_items;
create trigger project_builder_refresh_queue_items_set_updated_at
before update on public.project_builder_refresh_queue_items
for each row
execute function public.set_updated_at();

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
