create table if not exists public.project_code_states (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  active_file_path text not null,
  open_file_paths jsonb not null default '[]'::jsonb,
  scaffold_source_revision_number integer not null default 1,
  source_visual_updated_at timestamptz not null default timezone('utc', now()),
  manual_changes boolean not null default false,
  last_generated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_code_files (
  id uuid primary key default gen_random_uuid(),
  code_state_id uuid not null references public.project_code_states(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  path text not null,
  directory text not null,
  name text not null,
  extension text not null,
  file_kind text not null check (
    file_kind in ('route', 'component', 'config', 'style', 'data', 'integration')
  ),
  language text not null check (
    language in ('tsx', 'ts', 'css', 'json')
  ),
  order_index integer not null default 0,
  content text not null,
  created_from_visual_page_id text,
  created_from_section_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (code_state_id, path)
);

create index if not exists idx_project_code_files_project_id
  on public.project_code_files(project_id, order_index);

create index if not exists idx_project_code_files_directory
  on public.project_code_files(project_id, directory);
