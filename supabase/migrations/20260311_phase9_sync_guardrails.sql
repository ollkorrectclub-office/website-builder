create table if not exists public.project_code_file_links (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.project_code_files(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  visual_state_id uuid not null references public.project_visual_states(id) on delete cascade,
  target_type text not null check (target_type in ('global', 'page', 'section')),
  role text not null check (
    role in (
      'layout_shell',
      'route_page',
      'section_renderer',
      'section_component',
      'project_content',
      'theme_tokens',
      'theme_styles'
    )
  ),
  visual_page_id uuid references public.project_visual_pages(id) on delete cascade,
  visual_section_id uuid references public.project_visual_sections(id) on delete cascade,
  target_label text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_project_code_file_links_project_id
  on public.project_code_file_links(project_id, file_id);

alter table public.project_code_file_revisions
  drop constraint if exists project_code_file_revisions_kind_check;

alter table public.project_code_file_revisions
  add constraint project_code_file_revisions_kind_check
  check (kind in ('scaffold', 'saved', 'synced'));
