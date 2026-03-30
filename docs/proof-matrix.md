# Consolidated Proof Matrix V1 (Phase 76)

Last verified: 2026-03-30 (UTC)
Repository: `ollkorrectclub-office/website-builder`
Evidence policy: This matrix includes only directly verifiable GitHub Actions evidence from successful `main` branch runs.

## Fully Proven Flows

| Major flow | Workflow name | Latest passing run on `main` | What was proven | Artifact evidence | Summary proof details |
| --- | --- | --- | --- | --- | --- |
| Workspace membership proof | Workspace Membership Optional Proof (Supabase) | https://github.com/ollkorrectclub-office/website-builder/actions/runs/23670002378 | Supabase-backed optional workspace membership proof path succeeds on `main`. | https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6153570302/zip (wrapper logs), https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6153570176/zip (test results), https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6153570065/zip (Playwright report) | Run conclusion: `success`. Jobs `success`: `Resolve optional workspace membership proof gates`, `Workspace membership optional proof (Supabase)`. Summary step present: `Write optional workspace membership proof job summary`. |
| Deploy execution proof | Deploy Execution Live Smoke | https://github.com/ollkorrectclub-office/website-builder/actions/runs/23709407098 | Hosted deploy execution smoke verification succeeds on `main`. | https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6165841965/zip (wrapper logs), https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6165841924/zip (test results), https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6165841877/zip (Playwright report) | Run conclusion: `success`. Job `success`: `deploy-execution-live-smoke`. Verification step `success`: `Run env-gated live deploy execution smoke verification`. Summary step present: `Write deploy execution job summary`. |
| Hosted planner proof | Planner Provider Live Proof | https://github.com/ollkorrectclub-office/website-builder/actions/runs/23706955250 | Hosted planner provider flow completes end-to-end on `main`. | https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6165163116/zip (wrapper logs), https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6165163072/zip (test results), https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6165163037/zip (Playwright report) | Run conclusion: `success`. Job `success`: `planner-provider-live-proof`. Verification step `success`: `Run live planner provider proof`. Summary step present: `Write planner provider live proof job summary`. |
| Hosted patch proof | Patch Provider Live Proof | https://github.com/ollkorrectclub-office/website-builder/actions/runs/23706955242 | Hosted patch provider flow executes and validates end-to-end on `main`. | https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6165162417/zip (wrapper logs), https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6165162391/zip (test results), https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6165162319/zip (Playwright report) | Run conclusion: `success`. Job `success`: `patch-provider-live-proof`. Verification step `success`: `Run live patch provider proof`. Summary step present: `Write patch provider live proof job summary`. |
| Provider Live Smoke proof | Provider Live Smoke | https://github.com/ollkorrectclub-office/website-builder/actions/runs/23719167714 | Provider-backed live smoke execution succeeds on `main`. | https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6168428278/zip (wrapper logs), https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6168428214/zip (test results), https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6168428157/zip (Playwright report) | Run conclusion: `success`. Job `success`: `provider-live-smoke`. Verification step `success`: `Run env-gated live smoke verification`. Summary step present: `Write provider live smoke job summary`. |
| Provider Supabase Parity proof | Provider Supabase Parity | https://github.com/ollkorrectclub-office/website-builder/actions/runs/23719167734 | Supabase provider parity verification passes for covered scenarios on `main`. | https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6168431988/zip (wrapper logs), https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6168431949/zip (test results), https://api.github.com/repos/ollkorrectclub-office/website-builder/actions/artifacts/6168431915/zip (Playwright report) | Run conclusion: `success`. Job `success`: `provider-supabase-parity`. Verification step `success`: `Run Supabase provider parity verification`. Summary step present: `Write provider Supabase parity job summary`. |

## Partially Proven Flows

None recorded in this phase scope.

## Not-Yet-Proven Flows

None recorded in this phase scope.

## Notes

- This matrix is documentation consolidation only and does not alter product behavior.
- Evidence is taken from latest successful GitHub Actions runs on `main` at verification time.
