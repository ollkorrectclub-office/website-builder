alter table public.project_model_adapter_runs
  add column if not exists retry_of_run_id uuid references public.project_model_adapter_runs(id) on delete set null,
  add column if not exists attempt_number integer not null default 1;

create index if not exists idx_project_model_adapter_runs_retry
  on public.project_model_adapter_runs (project_id, capability, retry_of_run_id, started_at desc);
