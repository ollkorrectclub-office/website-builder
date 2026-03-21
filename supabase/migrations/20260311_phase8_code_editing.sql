alter table public.project_code_files
  add column if not exists ownership text not null default 'scaffold_owned'
    check (ownership in ('visual_owned', 'scaffold_owned')),
  add column if not exists edit_policy text not null default 'locked'
    check (edit_policy in ('locked', 'single_file_draft')),
  add column if not exists current_revision_id uuid,
  add column if not exists current_revision_number integer not null default 1,
  add column if not exists draft_content text,
  add column if not exists draft_updated_at timestamptz,
  add column if not exists draft_base_revision_id uuid,
  add column if not exists draft_base_revision_number integer;

create table if not exists public.project_code_file_revisions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.project_code_files(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  revision_number integer not null,
  kind text not null check (kind in ('scaffold', 'saved')),
  content text not null,
  change_summary text not null,
  authored_by text not null check (authored_by in ('system', 'user')),
  base_revision_id uuid,
  base_revision_number integer,
  created_at timestamptz not null default timezone('utc', now()),
  unique (file_id, revision_number)
);

create index if not exists idx_project_code_file_revisions_project_id
  on public.project_code_file_revisions(project_id, file_id, revision_number desc);
