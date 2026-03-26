alter table public.workspace_member_events
  add column if not exists previous_owner_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists previous_owner_name text,
  add column if not exists previous_owner_email text,
  add column if not exists next_owner_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists next_owner_name text,
  add column if not exists next_owner_email text;
