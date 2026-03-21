alter table public.project_generation_runs
  drop constraint if exists project_generation_runs_trigger_check;

alter table public.project_generation_runs
  add constraint project_generation_runs_trigger_check
  check (trigger in ('plan_approved', 'manual_rerun'));
