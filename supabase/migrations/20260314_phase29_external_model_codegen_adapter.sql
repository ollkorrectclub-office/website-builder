create table if not exists public.project_model_adapter_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  planning_selection text not null check (planning_selection in ('deterministic_internal', 'external_model')),
  generation_selection text not null check (generation_selection in ('deterministic_internal', 'external_model')),
  patch_selection text not null check (patch_selection in ('deterministic_internal', 'external_model')),
  external_provider_key text check (external_provider_key in ('openai_compatible', 'custom_http')),
  external_provider_label text,
  external_endpoint_url text,
  external_api_key_env_var text,
  planning_model text,
  generation_model text,
  patch_model text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id)
);

create index if not exists idx_project_model_adapter_configs_project
  on public.project_model_adapter_configs (project_id);

drop trigger if exists project_model_adapter_configs_set_updated_at on public.project_model_adapter_configs;
create trigger project_model_adapter_configs_set_updated_at
before update on public.project_model_adapter_configs
for each row
execute function public.set_updated_at();

create table if not exists public.project_model_adapter_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  capability text not null check (capability in ('planning', 'generation', 'patch_suggestion')),
  requested_selection text not null check (requested_selection in ('deterministic_internal', 'external_model')),
  executed_selection text not null check (executed_selection in ('deterministic_internal', 'external_model')),
  source_type text not null check (source_type in ('deterministic_internal', 'external_model')),
  execution_mode text not null check (execution_mode in ('selected', 'fallback')),
  requested_adapter_key text not null,
  executed_adapter_key text not null,
  provider_key text check (provider_key in ('openai_compatible', 'custom_http')),
  provider_label text,
  model_name text,
  endpoint_url text,
  fallback_reason text,
  summary text not null default '',
  metadata_json jsonb not null default '{}'::jsonb,
  status text not null check (status in ('completed', 'failed')),
  trigger text not null default '',
  linked_entity_type text check (linked_entity_type in ('planner_run', 'generation_run', 'patch_proposal')),
  linked_entity_id uuid,
  error_message text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_project_model_adapter_runs_project
  on public.project_model_adapter_runs (project_id, started_at desc);

create index if not exists idx_project_model_adapter_runs_project_capability
  on public.project_model_adapter_runs (project_id, capability, started_at desc);

drop trigger if exists project_model_adapter_runs_set_updated_at on public.project_model_adapter_runs;
create trigger project_model_adapter_runs_set_updated_at
before update on public.project_model_adapter_runs
for each row
execute function public.set_updated_at();

alter table public.project_planner_runs
  drop constraint if exists project_planner_runs_source_check;

alter table public.project_planner_runs
  add constraint project_planner_runs_source_check
  check (source in ('mock_planner', 'rules_planner_v1', 'external_model_adapter_v1'));

alter table public.project_generation_runs
  drop constraint if exists project_generation_runs_source_check;

alter table public.project_generation_runs
  add constraint project_generation_runs_source_check
  check (source in ('deterministic_generator_v1', 'external_codegen_adapter_v1'));

alter table public.project_code_patch_proposals
  drop constraint if exists project_code_patch_proposals_source_check;

alter table public.project_code_patch_proposals
  add constraint project_code_patch_proposals_source_check
  check (source in ('mock_assistant', 'external_patch_adapter_v1'));

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
      'adapter_config_updated',
      'model_adapter_run',
      'preview_state'
    )
  );
