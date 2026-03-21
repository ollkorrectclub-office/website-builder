create table if not exists project_audit_timeline_events (
  id text primary key,
  project_id uuid not null references projects (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  source text not null check (source in ('plan', 'visual', 'code', 'preview')),
  kind text not null check (
    kind in (
      'plan_revision',
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
  ),
  title text not null,
  summary text not null,
  actor_type text not null check (actor_type in ('system', 'user', 'assistant', 'runtime')),
  actor_label text not null,
  entity_type text not null,
  entity_id text,
  linked_tab text not null check (linked_tab in ('plan', 'visual', 'code', 'preview')),
  link_context jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists project_audit_timeline_events_project_idx
  on project_audit_timeline_events (project_id, occurred_at desc);

create index if not exists project_audit_timeline_events_project_source_idx
  on project_audit_timeline_events (project_id, source, occurred_at desc);
