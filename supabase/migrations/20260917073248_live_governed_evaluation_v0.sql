begin;

create table public.live_governed_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  run_type text not null default 'live_governed_evaluation_v0'
    check (run_type = 'live_governed_evaluation_v0'),
  intelligence_id text not null
    check (intelligence_id in ('communicator', 'mediator', 'drafter', 'refiner', 'origin')),
  status text not null default 'accepted'
    check (status in ('accepted', 'executing_model', 'executing_nexus', 'evaluating_governance', 'completed', 'failed')),
  input_payload jsonb not null,
  input_sha256 text not null check (input_sha256 ~ '^[0-9a-f]{64}$'),
  model_provider text not null default 'openai' check (model_provider = 'openai'),
  model_name text not null default 'gpt-5.6-luna' check (model_name = 'gpt-5.6-luna'),
  model_response_id text,
  model_output_sha256 text check (model_output_sha256 is null or model_output_sha256 ~ '^[0-9a-f]{64}$'),
  model_usage jsonb,
  model_evidence jsonb,
  nexus_evidence jsonb,
  governance_evidence jsonb,
  normalized_result jsonb,
  failure_stage text,
  failure_code text,
  external_release_performed boolean not null default false check (external_release_performed = false),
  production_ledger_claim boolean not null default false check (production_ledger_claim = false),
  compliance_certification_claim boolean not null default false check (compliance_certification_claim = false),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, client_request_id),
  check (
    status <> 'completed'
    or (
      model_response_id is not null
      and model_output_sha256 is not null
      and model_evidence is not null
      and nexus_evidence is not null
      and governance_evidence is not null
      and normalized_result is not null
      and completed_at is not null
      and failure_stage is null
      and failure_code is null
    )
  ),
  check (
    status <> 'failed'
    or (failure_stage is not null and failure_code is not null and completed_at is not null)
  )
);

create table public.live_governed_evaluation_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.live_governed_evaluation_runs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  event_type text not null check (event_type ~ '^[a-z0-9_]{3,80}$'),
  payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (run_id, sequence)
);

create index live_governed_evaluation_runs_workspace_created_idx
  on public.live_governed_evaluation_runs (workspace_id, created_at desc);
create index live_governed_evaluation_runs_user_created_idx
  on public.live_governed_evaluation_runs (user_id, created_at desc);
create index live_governed_evaluation_events_run_sequence_idx
  on public.live_governed_evaluation_events (run_id, sequence);

alter table public.live_governed_evaluation_runs enable row level security;
alter table public.live_governed_evaluation_events enable row level security;

create policy live_governed_evaluation_runs_member_select
  on public.live_governed_evaluation_runs
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

create policy live_governed_evaluation_events_member_select
  on public.live_governed_evaluation_events
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

revoke all on public.live_governed_evaluation_runs from anon, authenticated;
revoke all on public.live_governed_evaluation_events from anon, authenticated;
grant select on public.live_governed_evaluation_runs to authenticated;
grant select on public.live_governed_evaluation_events to authenticated;
grant all on public.live_governed_evaluation_runs to service_role;
grant all on public.live_governed_evaluation_events to service_role;
grant usage, select on sequence public.live_governed_evaluation_events_id_seq to service_role;

create or replace function public.reject_live_governed_evaluation_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'live_governed_evaluation_events is append-only';
end;
$$;

revoke all on function public.reject_live_governed_evaluation_event_mutation() from public;

create trigger live_governed_evaluation_events_append_only
before update or delete on public.live_governed_evaluation_events
for each row execute function public.reject_live_governed_evaluation_event_mutation();

commit;
