alter table public.project_model_adapter_runs
  add column if not exists latency_ms integer,
  add column if not exists trace_json jsonb;

alter table public.project_model_adapter_runs
  alter column trace_json set default '{}'::jsonb;

update public.project_model_adapter_runs
set trace_json = '{}'::jsonb
where trace_json is null;
