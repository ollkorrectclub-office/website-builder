create table if not exists public.project_deploy_releases (
  id uuid primary key default gen_random_uuid(),
  deploy_target_id uuid not null references public.project_deploy_targets(id) on delete cascade,
  deploy_run_id uuid not null references public.project_deploy_runs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  release_number integer not null,
  name text not null default '',
  notes text not null default '',
  status text not null check (status in ('promoted')),
  source_plan_revision_id uuid not null references public.project_plan_revisions(id) on delete cascade,
  source_plan_revision_number integer not null,
  source_visual_revision_number integer not null,
  source_code_revision_number integer not null,
  source_generation_run_id uuid references public.project_generation_runs(id) on delete set null,
  runtime_source text not null check (runtime_source in ('accepted_generation_target', 'visual_fallback')),
  promoted_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (deploy_run_id),
  unique (project_id, release_number)
);

create index if not exists project_deploy_releases_project_idx
  on public.project_deploy_releases (project_id, release_number desc);

drop trigger if exists project_deploy_releases_set_updated_at on public.project_deploy_releases;
create trigger project_deploy_releases_set_updated_at
before update on public.project_deploy_releases
for each row
execute function public.set_updated_at();

alter table public.project_deploy_targets
  add column if not exists settings_json jsonb not null default '{
    "adapterKey": "static_snapshot_v1",
    "environmentKey": "production",
    "primaryDomain": "",
    "outputDirectory": ".output/deploy",
    "installCommand": "npm install",
    "buildCommand": "npm run build",
    "startCommand": "npm run start",
    "nodeVersion": "22.x",
    "envContract": [
      {
        "key": "NEXT_PUBLIC_APP_URL",
        "required": true,
        "description": "Primary public URL used by the generated app shell."
      }
    ],
    "adapterConfig": [
      { "key": "framework", "value": "nextjs-app-router" },
      { "key": "artifactMode", "value": "deploy-snapshot" }
    ]
  }'::jsonb,
  add column if not exists latest_release_id uuid references public.project_deploy_releases(id) on delete set null,
  add column if not exists latest_release_name text,
  add column if not exists latest_release_number integer;

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
      'preview_state'
    )
  );
