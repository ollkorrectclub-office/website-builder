alter table public.project_code_file_revisions
  add column if not exists source_proposal_id uuid,
  add column if not exists source_proposal_title text;

alter table public.project_code_patch_proposals
  add column if not exists invalidated_by_revision_id uuid,
  add column if not exists invalidated_by_revision_number integer;
