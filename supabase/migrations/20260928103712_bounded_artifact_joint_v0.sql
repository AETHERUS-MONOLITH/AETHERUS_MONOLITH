begin;

create table public.bounded_artifact_joint_runs (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  flow_type text not null default 'bounded_artifact_joint_v0' check (flow_type = 'bounded_artifact_joint_v0'),
  contract_version text not null default '0.1' check (contract_version = '0.1'),
  status text not null default 'pending' check (status in ('pending','active','completed','blocked','failed')),
  current_stage text check (current_stage is null or current_stage in ('communicator','mediator','drafter','refiner','origin')),
  request_payload jsonb not null,
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  consent_reference text not null check (char_length(consent_reference) between 10 and 200),
  terminal_result jsonb,
  failure_code text,
  external_release_performed boolean not null default false check (external_release_performed = false),
  production_ledger_claim boolean not null default false check (production_ledger_claim = false),
  compliance_certification_claim boolean not null default false check (compliance_certification_claim = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id,user_id,client_request_id),
  unique (id,workspace_id,user_id),
  foreign key (workspace_id,user_id) references public.workspace_memberships(workspace_id,user_id) on delete restrict,
  check (status not in ('completed','blocked','failed') or completed_at is not null),
  check (status not in ('blocked','failed') or failure_code is not null)
);

create table public.bounded_artifact_joint_stages (
  id uuid primary key default gen_random_uuid(),
  joint_flow_id uuid not null references public.bounded_artifact_joint_runs(id) on delete restrict,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  ordinal smallint not null check (ordinal between 1 and 5),
  intelligence_id text not null check (intelligence_id in ('communicator','mediator','drafter','refiner','origin')),
  state text not null default 'pending' check (state in ('pending','active','completed','skipped','blocked','failed')),
  child_client_request_id uuid unique,
  child_run_id uuid unique references public.live_governed_evaluation_runs(id) on delete restrict,
  input_schema_version text not null default '0.1',
  input_sha256 text check (input_sha256 is null or input_sha256 ~ '^[0-9a-f]{64}$'),
  output_schema_version text,
  output_sha256 text check (output_sha256 is null or output_sha256 ~ '^[0-9a-f]{64}$'),
  artifact_identity text check (artifact_identity is null or artifact_identity ~ '^[0-9a-f]{64}$'),
  incoming_handoff_sha256 text check (incoming_handoff_sha256 is null or incoming_handoff_sha256 ~ '^[0-9a-f]{64}$'),
  failure_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (joint_flow_id,ordinal),
  unique (joint_flow_id,intelligence_id),
  foreign key (joint_flow_id,workspace_id,user_id) references public.bounded_artifact_joint_runs(id,workspace_id,user_id) on delete restrict,
  check ((ordinal,intelligence_id) in ((1,'communicator'),(2,'mediator'),(3,'drafter'),(4,'refiner'),(5,'origin'))),
  check (state <> 'completed' or (child_run_id is not null and output_sha256 is not null and completed_at is not null)),
  check (state not in ('skipped','blocked','failed') or completed_at is not null)
);

create table public.bounded_artifact_joint_events (
  id bigint generated always as identity primary key,
  joint_flow_id uuid not null references public.bounded_artifact_joint_runs(id) on delete restrict,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  sequence integer not null check (sequence > 0),
  event_type text not null check (event_type ~ '^[a-z0-9_]{3,80}$'),
  payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (joint_flow_id,sequence),
  foreign key (joint_flow_id,workspace_id,user_id) references public.bounded_artifact_joint_runs(id,workspace_id,user_id) on delete restrict
);

create index bounded_artifact_joint_runs_workspace_created_idx
  on public.bounded_artifact_joint_runs (workspace_id,created_at desc);
create index bounded_artifact_joint_stages_flow_ordinal_idx
  on public.bounded_artifact_joint_stages (joint_flow_id,ordinal);
create index bounded_artifact_joint_events_flow_sequence_idx
  on public.bounded_artifact_joint_events (joint_flow_id,sequence);

alter table public.bounded_artifact_joint_runs enable row level security;
alter table public.bounded_artifact_joint_stages enable row level security;
alter table public.bounded_artifact_joint_events enable row level security;

create policy bounded_artifact_joint_runs_member_select on public.bounded_artifact_joint_runs
  for select to authenticated using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
create policy bounded_artifact_joint_stages_member_select on public.bounded_artifact_joint_stages
  for select to authenticated using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
create policy bounded_artifact_joint_events_member_select on public.bounded_artifact_joint_events
  for select to authenticated using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));

revoke all on public.bounded_artifact_joint_runs, public.bounded_artifact_joint_stages, public.bounded_artifact_joint_events from anon,authenticated;
grant select on public.bounded_artifact_joint_runs, public.bounded_artifact_joint_stages, public.bounded_artifact_joint_events to authenticated;
grant all on public.bounded_artifact_joint_runs, public.bounded_artifact_joint_stages, public.bounded_artifact_joint_events to service_role;
grant usage,select on sequence public.bounded_artifact_joint_events_id_seq to service_role;

create function public.reject_bounded_artifact_joint_event_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'bounded_artifact_joint_events is append-only';
end;
$$;
revoke all on function public.reject_bounded_artifact_joint_event_mutation() from public;
create trigger bounded_artifact_joint_events_append_only
  before update or delete on public.bounded_artifact_joint_events
  for each row execute function public.reject_bounded_artifact_joint_event_mutation();

create function public.guard_bounded_artifact_joint_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'bounded artifact joint evidence cannot be deleted'; end if;
  if tg_table_name = 'bounded_artifact_joint_runs' then
    if row(old.id,old.client_request_id,old.workspace_id,old.user_id,old.flow_type,old.contract_version,old.request_payload,old.request_sha256,old.consent_reference)
       is distinct from row(new.id,new.client_request_id,new.workspace_id,new.user_id,new.flow_type,new.contract_version,new.request_payload,new.request_sha256,new.consent_reference) then
      raise exception 'bounded artifact joint run identity is immutable';
    end if;
  else
    if row(old.id,old.joint_flow_id,old.workspace_id,old.user_id,old.ordinal,old.intelligence_id,old.child_client_request_id)
       is distinct from row(new.id,new.joint_flow_id,new.workspace_id,new.user_id,new.ordinal,new.intelligence_id,new.child_client_request_id)
       and old.child_client_request_id is not null then
      raise exception 'bounded artifact joint stage identity is immutable';
    end if;
    if old.output_sha256 is not null and old.output_sha256 is distinct from new.output_sha256 then
      raise exception 'bounded artifact joint output digest is immutable';
    end if;
    if old.incoming_handoff_sha256 is not null and old.incoming_handoff_sha256 is distinct from new.incoming_handoff_sha256 then
      raise exception 'bounded artifact joint handoff digest is immutable';
    end if;
    if old.child_run_id is not null and old.child_run_id is distinct from new.child_run_id then
      raise exception 'bounded artifact joint child run identity is immutable';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_bounded_artifact_joint_identity() from public;
create trigger bounded_artifact_joint_runs_guard before update or delete on public.bounded_artifact_joint_runs
  for each row execute function public.guard_bounded_artifact_joint_identity();
create trigger bounded_artifact_joint_stages_guard before update or delete on public.bounded_artifact_joint_stages
  for each row execute function public.guard_bounded_artifact_joint_identity();

commit;
