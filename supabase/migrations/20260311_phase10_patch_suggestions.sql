create table if not exists public.project_code_patch_proposals (
  id uuid primary key default gen_random_uuid(),
  code_state_id uuid not null references public.project_code_states(id) on delete cascade,
  file_id uuid not null references public.project_code_files(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  file_path text not null,
  title text not null,
  request_prompt text not null,
  rationale text not null,
  change_summary text not null,
  status text not null check (status in ('pending', 'applied', 'rejected', 'stale')),
  source text not null check (source in ('mock_assistant')),
  base_revision_id uuid,
  base_revision_number integer,
  base_content text not null,
  proposed_content text not null,
  resolved_revision_id uuid,
  resolution_note text,
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create index if not exists idx_project_code_patch_proposals_project_id
  on public.project_code_patch_proposals(project_id, file_id, created_at desc);
