alter table public.project_code_file_revisions
  drop constraint if exists project_code_file_revisions_kind_check;

alter table public.project_code_file_revisions
  add constraint project_code_file_revisions_kind_check
  check (kind in ('scaffold', 'saved', 'synced', 'restored'));

alter table public.project_code_file_revisions
  add column if not exists restore_source text
    check (restore_source in ('revision', 'scaffold')),
  add column if not exists restored_from_revision_id uuid,
  add column if not exists restored_from_revision_number integer;

alter table public.project_code_patch_proposals
  add column if not exists archived_at timestamptz,
  add column if not exists archive_reason text;
