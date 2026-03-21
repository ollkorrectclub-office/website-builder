create table if not exists public.project_visual_states (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  active_page_id uuid,
  theme_tokens jsonb not null default '{}'::jsonb,
  scaffold_source_revision_number integer not null default 1,
  manual_changes boolean not null default false,
  last_scaffold_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_visual_pages (
  id uuid primary key default gen_random_uuid(),
  visual_state_id uuid not null references public.project_visual_states(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  page_key text not null,
  title text not null,
  slug text not null,
  order_index integer not null default 0,
  content_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (visual_state_id, page_key)
);

create table if not exists public.project_visual_sections (
  id uuid primary key default gen_random_uuid(),
  visual_state_id uuid not null references public.project_visual_states(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  page_id uuid not null references public.project_visual_pages(id) on delete cascade,
  section_key text not null,
  section_type text not null check (
    section_type in (
      'hero',
      'features',
      'testimonials',
      'pricing',
      'faq',
      'contact',
      'navbar',
      'footer',
      'custom_generic'
    )
  ),
  title text not null,
  label text not null,
  order_index integer not null default 0,
  is_visible boolean not null default true,
  content_payload jsonb not null default '{}'::jsonb,
  created_from_plan text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_project_visual_pages_project_id
  on public.project_visual_pages(project_id, order_index);

create index if not exists idx_project_visual_sections_project_id
  on public.project_visual_sections(project_id, page_id, order_index);
