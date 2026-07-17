-- Phase 5 Palisade and Conduit integration for github_pages_outward_publication@0.1 only.
-- Additive private evidence and fixed server-side boundaries; no generalized policy or dispatch service.

create or replace function private.github_pages_canonical_json_v0(value jsonb)
returns text
language sql
immutable
strict
security definer
set search_path = ''
as $$
  select case pg_catalog.jsonb_typeof(value)
    when 'object' then '{' || coalesce((
      select pg_catalog.string_agg(pg_catalog.to_jsonb(k)::text || ':' || private.github_pages_canonical_json_v0(value -> k), ',' order by k collate "C")
      from pg_catalog.jsonb_object_keys(value) as keys(k)
    ), '') || '}'
    when 'array' then '[' || coalesce((
      select pg_catalog.string_agg(private.github_pages_canonical_json_v0(element), ',' order by ordinal)
      from pg_catalog.jsonb_array_elements(value) with ordinality as elements(element, ordinal)
    ), '') || ']'
    else value::text
  end;
$$;

create or replace function private.github_pages_canonical_sha256_v0(value jsonb)
returns text
language sql
immutable
strict
security definer
set search_path = ''
as $$
  select private.github_pages_publication_sha256_v0(private.github_pages_canonical_json_v0(value));
$$;

create table private.github_pages_palisade_decisions_v0 (
  palisade_decision_id uuid primary key,
  schema_version text not null,
  request_id uuid not null references private.github_pages_publication_authorizations_v0(request_id) on delete restrict,
  authorization_record_id uuid not null,
  execution_identity_sha256 text not null,
  action_manifest_sha256 text not null,
  policy_bundle_id text not null,
  policy_bundle_version text not null,
  policy_rule_id text not null,
  policy_rule_sha256 text not null,
  policy_surface text not null,
  claim_id text not null,
  requested_action text not null,
  action_identifier text not null,
  policy_input jsonb not null,
  policy_input_sha256 text not null,
  decision text not null,
  allowed boolean not null,
  reason_codes jsonb not null,
  required_evidence jsonb not null,
  missing_evidence jsonb not null,
  phase4_status text not null,
  phase4_status_receipt_sha256 text not null,
  workspace_id uuid not null,
  repository_id bigint not null,
  workflow_run_id bigint not null,
  run_attempt integer not null,
  artifact_id bigint not null,
  target text not null,
  deploy_executor_sha text not null,
  evaluated_at timestamptz not null,
  palisade_decision_sha256 text not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint github_pages_palisade_decisions_v0_schema_ck check (schema_version = '0.5'),
  constraint github_pages_palisade_decisions_v0_identity_ck check (authorization_record_id = request_id),
  constraint github_pages_palisade_decisions_v0_tuple_ck check (
    policy_bundle_id = 'palisade-policy-bundle.v0'
    and policy_bundle_version = '0.5.0'
    and policy_rule_id = 'github-pages-outward-publication-authority-v0'
    and policy_rule_sha256 = '401562bd846271357e4e250f68da5b757e20aacc8005f5a2eb73cd0f989cb18b'
    and policy_surface = 'github_pages_outward_publication_boundary'
    and claim_id = 'github_pages_outward_publication_authority'
    and requested_action = 'github_pages_outward_publication@0.1'
    and action_identifier = 'github_pages_outward_publication@0.1'
  ),
  constraint github_pages_palisade_decisions_v0_fixed_ck check (
    workspace_id = '9abed891-7950-4937-a2aa-4b957d8a4bd1'::uuid
    and repository_id = 1167751543 and run_attempt = 1
    and target = 'https://camilocarlone.com/'
    and deploy_executor_sha = 'd6db90164ac5ed86f2b6aed7e0febac5b3c0c03e'
  ),
  constraint github_pages_palisade_decisions_v0_sha_ck check (
    execution_identity_sha256 ~ '^[0-9a-f]{64}$' and action_manifest_sha256 ~ '^[0-9a-f]{64}$'
    and policy_rule_sha256 ~ '^[0-9a-f]{64}$' and policy_input_sha256 ~ '^[0-9a-f]{64}$'
    and phase4_status_receipt_sha256 ~ '^[0-9a-f]{64}$' and palisade_decision_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint github_pages_palisade_decisions_v0_decision_ck check (
    decision in ('allow','deny','requires_evidence','requires_operator_review','runtime_enforcement_unavailable')
    and allowed = (decision = 'allow')
  ),
  constraint github_pages_palisade_decisions_v0_evidence_ck check (
    pg_catalog.jsonb_typeof(reason_codes) = 'array' and pg_catalog.jsonb_array_length(reason_codes) > 0
    and pg_catalog.jsonb_typeof(required_evidence) = 'array' and pg_catalog.jsonb_typeof(missing_evidence) = 'array'
  )
);

create unique index github_pages_palisade_decisions_v0_input_uidx
  on private.github_pages_palisade_decisions_v0(policy_input_sha256, phase4_status_receipt_sha256);
create unique index github_pages_palisade_decisions_v0_digest_uidx
  on private.github_pages_palisade_decisions_v0(palisade_decision_sha256);
create index github_pages_palisade_decisions_v0_request_idx
  on private.github_pages_palisade_decisions_v0(request_id, evaluated_at);

create table private.github_pages_conduit_invocations_v0 (
  conduit_invocation_id uuid primary key,
  schema_version text not null,
  palisade_decision_id uuid not null references private.github_pages_palisade_decisions_v0(palisade_decision_id) on delete restrict,
  palisade_decision_sha256 text not null,
  request_id uuid not null references private.github_pages_publication_authorizations_v0(request_id) on delete restrict,
  authorization_record_id uuid not null,
  execution_identity_sha256 text not null,
  action_manifest_sha256 text not null,
  governed_invocation_sha256 text not null,
  conduit_invocation_sha256 text not null,
  action_envelope jsonb not null,
  action_identifier text not null,
  workspace_id uuid not null,
  repository_id bigint not null,
  workflow_run_id bigint not null,
  run_attempt integer not null,
  artifact_id bigint not null,
  target text not null,
  deploy_executor_sha text not null,
  state text not null,
  failure_code text,
  invoked_at timestamptz not null,
  consumption_attempted_at timestamptz,
  completed_at timestamptz,
  phase4_consumption_receipt jsonb,
  phase4_consumption_receipt_sha256 text,
  deployment_permit boolean not null default false,
  result jsonb,
  result_sha256 text,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint github_pages_conduit_invocations_v0_schema_ck check (schema_version = '0.5'),
  constraint github_pages_conduit_invocations_v0_identity_ck check (authorization_record_id = request_id),
  constraint github_pages_conduit_invocations_v0_fixed_ck check (
    action_identifier = 'github_pages_outward_publication@0.1'
    and workspace_id = '9abed891-7950-4937-a2aa-4b957d8a4bd1'::uuid
    and repository_id = 1167751543 and run_attempt = 1
    and target = 'https://camilocarlone.com/'
    and deploy_executor_sha = 'd6db90164ac5ed86f2b6aed7e0febac5b3c0c03e'
  ),
  constraint github_pages_conduit_invocations_v0_sha_ck check (
    palisade_decision_sha256 ~ '^[0-9a-f]{64}$' and execution_identity_sha256 ~ '^[0-9a-f]{64}$'
    and action_manifest_sha256 ~ '^[0-9a-f]{64}$' and governed_invocation_sha256 ~ '^[0-9a-f]{64}$'
    and conduit_invocation_sha256 ~ '^[0-9a-f]{64}$'
    and (phase4_consumption_receipt_sha256 is null or phase4_consumption_receipt_sha256 ~ '^[0-9a-f]{64}$')
    and (result_sha256 is null or result_sha256 ~ '^[0-9a-f]{64}$')
  ),
  constraint github_pages_conduit_invocations_v0_state_ck check (
    state in ('created','policy_blocked','dispatching','consumed','consumption_failed','infrastructure_failed','result_validation_failed')
  ),
  constraint github_pages_conduit_invocations_v0_permit_ck check (
    (deployment_permit = false)
    or (state = 'consumed' and phase4_consumption_receipt is not null
      and phase4_consumption_receipt_sha256 is not null and result is not null and result_sha256 is not null)
  )
);

create unique index github_pages_conduit_invocations_v0_decision_uidx
  on private.github_pages_conduit_invocations_v0(palisade_decision_id);
create unique index github_pages_conduit_invocations_v0_digest_uidx
  on private.github_pages_conduit_invocations_v0(conduit_invocation_sha256);
create unique index github_pages_conduit_invocations_v0_governed_uidx
  on private.github_pages_conduit_invocations_v0(governed_invocation_sha256);
create index github_pages_conduit_invocations_v0_request_idx
  on private.github_pages_conduit_invocations_v0(request_id, invoked_at);

alter table private.github_pages_palisade_decisions_v0 enable row level security;
alter table private.github_pages_palisade_decisions_v0 force row level security;
alter table private.github_pages_conduit_invocations_v0 enable row level security;
alter table private.github_pages_conduit_invocations_v0 force row level security;
alter table private.github_pages_palisade_decisions_v0 owner to postgres;
alter table private.github_pages_conduit_invocations_v0 owner to postgres;
revoke all privileges on table private.github_pages_palisade_decisions_v0 from public, anon, authenticated, service_role;
revoke all privileges on table private.github_pages_conduit_invocations_v0 from public, anon, authenticated, service_role;

create or replace function private.enforce_github_pages_palisade_decision_v0()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then raise exception 'Palisade decisions are append-only'; end if;
  if pg_catalog.current_setting('private.github_pages_palisade_decision_write_v0', true) <> 'enabled' then
    raise exception 'direct Palisade decision insertion prohibited';
  end if;
  return new;
end;
$$;

create or replace function private.fail_github_pages_conduit_invocation_v0(target_invocation_id uuid, target_failure_code text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row private.github_pages_conduit_invocations_v0%rowtype;
  v_state text;
  v_result jsonb;
begin
  select i.* into strict v_row from private.github_pages_conduit_invocations_v0 as i
    where i.conduit_invocation_id=target_invocation_id for update;
  if v_row.state in ('policy_blocked','consumed','consumption_failed','infrastructure_failed','result_validation_failed') then return; end if;
  v_state := case
    when target_failure_code='result_validation_failed' then 'result_validation_failed'
    when target_failure_code like '%consumption%' or target_failure_code like 'phase4_%' then 'consumption_failed'
    else 'infrastructure_failed' end;
  v_result := pg_catalog.jsonb_build_object('deployment_permit',false,'failure_code',target_failure_code);
  perform pg_catalog.set_config('private.github_pages_conduit_invocation_write_v0','enabled',true);
  update private.github_pages_conduit_invocations_v0 as i set state=v_state,failure_code=target_failure_code,
    completed_at=pg_catalog.transaction_timestamp(),deployment_permit=false,result=v_result,
    result_sha256=private.github_pages_canonical_sha256_v0(v_result)
    where i.conduit_invocation_id=target_invocation_id;
end;
$$;

create or replace function private.complete_github_pages_conduit_invocation_v0(target_invocation_id uuid, receipt jsonb)
returns table (
  request_id uuid, authorization_record_id uuid, action_manifest_sha256 text, artifact_id bigint,
  workflow_run_id bigint, run_attempt integer, canonical_public_target text, deploy_executor_sha text,
  palisade_decision_id uuid, palisade_decision_sha256 text, conduit_invocation_id uuid,
  conduit_invocation_sha256 text, governed_invocation_sha256 text, consumption_receipt_sha256 text,
  state text, deployment_permit boolean, result_sha256 text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row private.github_pages_conduit_invocations_v0%rowtype;
  v_result jsonb;
  v_result_sha text;
  v_failure text;
begin
  select i.* into strict v_row from private.github_pages_conduit_invocations_v0 as i
    where i.conduit_invocation_id=target_invocation_id for update;
  if v_row.state <> 'dispatching' then
    return query select v_row.request_id,v_row.authorization_record_id,v_row.action_manifest_sha256,v_row.artifact_id,
      v_row.workflow_run_id,v_row.run_attempt,v_row.target,v_row.deploy_executor_sha,v_row.palisade_decision_id,
      v_row.palisade_decision_sha256,v_row.conduit_invocation_id,v_row.conduit_invocation_sha256,
      v_row.governed_invocation_sha256,v_row.phase4_consumption_receipt_sha256,v_row.state,false,v_row.result_sha256;
    return;
  end if;
  if pg_catalog.jsonb_typeof(receipt)<>'object'
    or receipt->>'status' is distinct from 'consumed'
    or receipt->>'deployment_permit' is distinct from 'true'
    or receipt->>'request_id' is distinct from v_row.request_id::text
    or receipt->>'authorization_record_id' is distinct from v_row.authorization_record_id::text
    or receipt->>'action_manifest_sha256' is distinct from v_row.action_manifest_sha256
    or receipt->>'artifact_id' is distinct from v_row.artifact_id::text
    or receipt->>'workflow_run_id' is distinct from v_row.workflow_run_id::text
    or receipt->>'run_attempt' is distinct from v_row.run_attempt::text
    or receipt->>'target' is distinct from v_row.target
    or receipt->>'deploy_executor_sha' is distinct from v_row.deploy_executor_sha
    or receipt->>'palisade_decision_id' is distinct from v_row.palisade_decision_id::text
    or receipt->>'palisade_decision_sha256' is distinct from v_row.palisade_decision_sha256
    or receipt->>'conduit_invocation_id' is distinct from v_row.conduit_invocation_id::text
    or receipt->>'conduit_invocation_sha256' is distinct from v_row.conduit_invocation_sha256
    or receipt->>'governed_invocation_sha256' is distinct from v_row.governed_invocation_sha256
    or receipt->>'consumption_receipt_sha256' !~ '^[0-9a-f]{64}$' then
    v_failure := 'post_consumption_receipt_mismatch';
  end if;
  if v_failure is not null then
    v_result := pg_catalog.jsonb_build_object('deployment_permit',false,'failure_code',v_failure);
    v_result_sha := private.github_pages_canonical_sha256_v0(v_result);
    perform pg_catalog.set_config('private.github_pages_conduit_invocation_write_v0','enabled',true);
    update private.github_pages_conduit_invocations_v0 as i set state='result_validation_failed',failure_code=v_failure,
      completed_at=pg_catalog.transaction_timestamp(),phase4_consumption_receipt=receipt,
      phase4_consumption_receipt_sha256=receipt->>'consumption_receipt_sha256',deployment_permit=false,
      result=v_result,result_sha256=v_result_sha where i.conduit_invocation_id=target_invocation_id returning * into strict v_row;
  else
    v_result := pg_catalog.jsonb_build_object(
      'classification','governed_deployment_permit_issued','request_id',v_row.request_id,
      'conduit_invocation_id',v_row.conduit_invocation_id,'governed_invocation_sha256',v_row.governed_invocation_sha256,
      'consumption_receipt_sha256',receipt->>'consumption_receipt_sha256','deployment_permit',true
    );
    v_result_sha := private.github_pages_canonical_sha256_v0(v_result);
    perform pg_catalog.set_config('private.github_pages_conduit_invocation_write_v0','enabled',true);
    update private.github_pages_conduit_invocations_v0 as i set state='consumed',failure_code=null,
      completed_at=pg_catalog.transaction_timestamp(),phase4_consumption_receipt=receipt,
      phase4_consumption_receipt_sha256=receipt->>'consumption_receipt_sha256',deployment_permit=true,
      result=v_result,result_sha256=v_result_sha where i.conduit_invocation_id=target_invocation_id returning * into strict v_row;
  end if;
  return query select v_row.request_id,v_row.authorization_record_id,v_row.action_manifest_sha256,v_row.artifact_id,
    v_row.workflow_run_id,v_row.run_attempt,v_row.target,v_row.deploy_executor_sha,v_row.palisade_decision_id,
    v_row.palisade_decision_sha256,v_row.conduit_invocation_id,v_row.conduit_invocation_sha256,
    v_row.governed_invocation_sha256,v_row.phase4_consumption_receipt_sha256,v_row.state,v_row.deployment_permit,v_row.result_sha256;
end;
$$;

create or replace function private.prepare_github_pages_conduit_invocation_v0(envelope jsonb, oidc_evidence_sha256 text)
returns table (
  conduit_invocation_id uuid, state text, failure_code text, palisade_decision_id uuid,
  palisade_decision_sha256 text, conduit_invocation_sha256 text, governed_invocation_sha256 text,
  action_manifest jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_decision private.github_pages_palisade_decisions_v0%rowtype;
  v_auth private.github_pages_publication_authorizations_v0%rowtype;
  v_existing private.github_pages_conduit_invocations_v0%rowtype;
  v_id uuid := extensions.gen_random_uuid();
  v_governed jsonb;
  v_governed_sha text;
  v_invocation_sha text;
  v_state text := 'created';
  v_failure text;
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_expected_fields text[] := array[
    'schema_version','request_id','trace_id','correlation_id','action_identifier','policy_surface','claim_id','requested_action',
    'workspace_id','repository','repository_id','repository_ref','workflow_path','workflow_sha','workflow_run_id','run_attempt',
    'authorization_record_id','execution_identity_sha256','action_manifest_sha256','artifact_id','artifact_name','artifact_run_id',
    'artifact_run_attempt','built_artifact_sha256','canonical_public_target','environment','permitted_effect','deploy_executor_sha',
    'phase4_status_receipt_sha256','palisade_decision_id','palisade_decision_sha256'
  ];
begin
  if pg_catalog.jsonb_typeof(envelope) <> 'object' then raise exception 'Conduit envelope must be an object'; end if;
  if oidc_evidence_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'OIDC evidence digest invalid'; end if;
  if (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(envelope) as keys(k))
    is distinct from (select pg_catalog.array_agg(k order by k) from pg_catalog.unnest(v_expected_fields) as fields(k)) then
    raise exception 'Conduit envelope fields mismatch';
  end if;
  select d.* into strict v_decision from private.github_pages_palisade_decisions_v0 as d
    where d.palisade_decision_id=(envelope->>'palisade_decision_id')::uuid
      and d.palisade_decision_sha256=envelope->>'palisade_decision_sha256';
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_decision.palisade_decision_id::text, 0));
  select i.* into v_existing from private.github_pages_conduit_invocations_v0 as i
    where i.palisade_decision_id=v_decision.palisade_decision_id;
  if found then
    return query select v_existing.conduit_invocation_id,v_existing.state,v_existing.failure_code,
      v_existing.palisade_decision_id,v_existing.palisade_decision_sha256,v_existing.conduit_invocation_sha256,
      v_existing.governed_invocation_sha256,
      (select a.action_manifest from private.github_pages_publication_authorizations_v0 as a where a.request_id=v_existing.request_id);
    return;
  end if;
  select a.* into strict v_auth from private.github_pages_publication_authorizations_v0 as a where a.request_id=v_decision.request_id;
  v_governed := pg_catalog.jsonb_build_object(
    'action_identifier',envelope->>'action_identifier','policy_surface',envelope->>'policy_surface',
    'claim_id',envelope->>'claim_id','requested_action',envelope->>'requested_action',
    'request_id',envelope->>'request_id','authorization_record_id',envelope->>'authorization_record_id',
    'execution_identity_sha256',envelope->>'execution_identity_sha256','action_manifest_sha256',envelope->>'action_manifest_sha256',
    'workspace_id',envelope->>'workspace_id','repository_id',envelope->>'repository_id','repository_ref',envelope->>'repository_ref',
    'workflow_path',envelope->>'workflow_path','workflow_sha',envelope->>'workflow_sha','workflow_run_id',envelope->>'workflow_run_id',
    'run_attempt',(envelope->>'run_attempt')::integer,'artifact_id',envelope->>'artifact_id','artifact_name',envelope->>'artifact_name',
    'built_artifact_sha256',envelope->>'built_artifact_sha256','canonical_public_target',envelope->>'canonical_public_target',
    'environment',envelope->>'environment','permitted_effect',envelope->>'permitted_effect',
    'deploy_executor_sha',envelope->>'deploy_executor_sha','phase4_status_receipt_sha256',envelope->>'phase4_status_receipt_sha256',
    'palisade_decision_id',envelope->>'palisade_decision_id','palisade_decision_sha256',envelope->>'palisade_decision_sha256',
    'conduit_invocation_id',v_id
  );
  v_governed_sha := private.github_pages_canonical_sha256_v0(v_governed);
  v_invocation_sha := private.github_pages_canonical_sha256_v0(pg_catalog.jsonb_build_object(
    'schema_version','0.5','conduit_invocation_id',v_id,'governed_invocation_sha256',v_governed_sha,'envelope',envelope
  ));
  if v_decision.decision <> 'allow' or not v_decision.allowed then
    v_state := 'policy_blocked'; v_failure := 'palisade_non_allow';
  elsif envelope->>'schema_version' is distinct from '0.5'
    or envelope->>'action_identifier' is distinct from 'github_pages_outward_publication@0.1'
    or envelope->>'policy_surface' is distinct from 'github_pages_outward_publication_boundary'
    or envelope->>'claim_id' is distinct from 'github_pages_outward_publication_authority'
    or envelope->>'requested_action' is distinct from 'github_pages_outward_publication@0.1'
    or envelope->>'workspace_id' is distinct from v_auth.workspace_id::text
    or envelope->>'repository' is distinct from v_auth.repository
    or envelope->>'repository_id' is distinct from v_auth.repository_id::text
    or envelope->>'repository_ref' is distinct from v_auth.repository_ref
    or envelope->>'workflow_path' is distinct from v_auth.workflow_path
    or envelope->>'workflow_sha' is distinct from v_auth.workflow_sha
    or envelope->>'workflow_run_id' is distinct from v_auth.run_id::text
    or envelope->>'run_attempt' is distinct from v_auth.run_attempt::text
    or envelope->>'request_id' is distinct from v_auth.request_id::text
    or envelope->>'authorization_record_id' is distinct from v_auth.request_id::text
    or envelope->>'execution_identity_sha256' is distinct from v_auth.execution_identity_sha256
    or envelope->>'action_manifest_sha256' is distinct from v_auth.action_manifest_sha256
    or envelope->>'artifact_id' is distinct from v_auth.artifact_id::text
    or envelope->>'artifact_name' is distinct from v_auth.artifact_name
    or envelope->>'artifact_run_id' is distinct from v_auth.artifact_run_id::text
    or envelope->>'artifact_run_attempt' is distinct from v_auth.artifact_run_attempt::text
    or envelope->>'built_artifact_sha256' is distinct from v_auth.built_artifact_sha256
    or envelope->>'canonical_public_target' is distinct from v_auth.canonical_public_target
    or envelope->>'environment' is distinct from v_auth.environment_name
    or envelope->>'permitted_effect' is distinct from v_auth.permitted_effect
    or envelope->>'deploy_executor_sha' is distinct from v_auth.deploy_action_commit_sha
    or envelope->>'phase4_status_receipt_sha256' is distinct from v_decision.phase4_status_receipt_sha256
    or v_decision.request_id is distinct from v_auth.request_id
    or v_decision.execution_identity_sha256 is distinct from v_auth.execution_identity_sha256
    or v_decision.action_manifest_sha256 is distinct from v_auth.action_manifest_sha256 then
    v_state := 'result_validation_failed'; v_failure := 'same_invocation_binding_failed';
  end if;
  perform pg_catalog.set_config('private.github_pages_conduit_invocation_write_v0','enabled',true);
  insert into private.github_pages_conduit_invocations_v0(
    conduit_invocation_id,schema_version,palisade_decision_id,palisade_decision_sha256,request_id,authorization_record_id,
    execution_identity_sha256,action_manifest_sha256,governed_invocation_sha256,conduit_invocation_sha256,action_envelope,
    action_identifier,workspace_id,repository_id,workflow_run_id,run_attempt,artifact_id,target,deploy_executor_sha,
    state,failure_code,invoked_at,completed_at,result,result_sha256
  ) values (
    v_id,'0.5',v_decision.palisade_decision_id,v_decision.palisade_decision_sha256,v_auth.request_id,v_auth.request_id,
    v_auth.execution_identity_sha256,v_auth.action_manifest_sha256,v_governed_sha,v_invocation_sha,envelope,
    v_auth.action_identifier,v_auth.workspace_id,v_auth.repository_id,v_auth.run_id,v_auth.run_attempt,v_auth.artifact_id,
    v_auth.canonical_public_target,v_auth.deploy_action_commit_sha,'created',null,v_now,null,null,null
  );
  if v_state='created' then v_state := 'dispatching'; end if;
  update private.github_pages_conduit_invocations_v0 as i set state=v_state,failure_code=v_failure,
    consumption_attempted_at=case when v_state='dispatching' then v_now else null end,
    completed_at=case when v_state<>'dispatching' then v_now else null end,
    result=case when v_state<>'dispatching' then pg_catalog.jsonb_build_object('deployment_permit',false,'failure_code',v_failure) else null end,
    result_sha256=case when v_state<>'dispatching' then private.github_pages_canonical_sha256_v0(pg_catalog.jsonb_build_object('deployment_permit',false,'failure_code',v_failure)) else null end
    where i.conduit_invocation_id=v_id;
  return query select v_id,v_state,v_failure,v_decision.palisade_decision_id,v_decision.palisade_decision_sha256,
    v_invocation_sha,v_governed_sha,v_auth.action_manifest;
end;
$$;

alter table private.github_pages_publication_authorizations_v0
  add column consumption_palisade_decision_id uuid,
  add column consumption_palisade_decision_sha256 text,
  add column consumption_conduit_invocation_id uuid,
  add column consumption_conduit_invocation_sha256 text,
  add column consumption_governed_invocation_sha256 text,
  add column phase5_consumption_receipt_sha256 text;

alter table private.github_pages_publication_authorization_events_v0
  drop constraint github_pages_publication_authorization_events_v0_type_ck;
alter table private.github_pages_publication_authorization_events_v0
  add constraint github_pages_publication_authorization_events_v0_type_ck check (
    event_type in ('request_created','authorized','rejected','consumed','consumption_failed','expired','replay_rejected','phase5_consumption_bound')
  );

create or replace function private.enforce_github_pages_publication_authorization_write_v0()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('private.github_pages_publication_authorization_write_v0', true) <> 'enabled' then
    raise exception 'direct authorization table mutation prohibited';
  end if;
  if tg_op = 'DELETE' then raise exception 'authorization deletion prohibited'; end if;
  if tg_op = 'INSERT' then return new; end if;
  if old.request_id is distinct from new.request_id
    or old.execution_identity_sha256 is distinct from new.execution_identity_sha256
    or old.action_manifest is distinct from new.action_manifest
    or old.action_manifest_sha256 is distinct from new.action_manifest_sha256
    or old.request_key_sha256 is distinct from new.request_key_sha256
    or old.workspace_id is distinct from new.workspace_id
    or old.workflow_sha is distinct from new.workflow_sha
    or old.run_id is distinct from new.run_id
    or old.run_attempt is distinct from new.run_attempt
    or old.artifact_id is distinct from new.artifact_id
    or old.built_artifact_sha256 is distinct from new.built_artifact_sha256
    or old.canonical_public_target is distinct from new.canonical_public_target
  then raise exception 'bound authorization evidence is immutable'; end if;
  if old.status='consumed' and new.status='consumed'
    and pg_catalog.current_setting('private.github_pages_phase5_consumption_finalize_v0', true)='enabled'
    and old.consumption_palisade_decision_id is null and new.consumption_palisade_decision_id is not null
    and old.consumption_conduit_invocation_id is null and new.consumption_conduit_invocation_id is not null
    and new.phase5_consumption_receipt_sha256 ~ '^[0-9a-f]{64}$' then
    new.updated_at := pg_catalog.transaction_timestamp();
    return new;
  end if;
  if old.status in ('rejected','consumed','consumption_failed','expired') then raise exception 'terminal authorization state is immutable'; end if;
  if not ((old.status='pending' and new.status in ('authorized','rejected','expired'))
    or (old.status='authorized' and new.status in ('consumed','consumption_failed','expired'))) then
    raise exception 'prohibited authorization transition % -> %',old.status,new.status;
  end if;
  if old.expires_at is not null and new.expires_at > old.expires_at then raise exception 'authorization expiry extension prohibited'; end if;
  new.updated_at := pg_catalog.transaction_timestamp();
  return new;
end;
$$;

alter function private.consume_github_pages_publication_authorization_v0(uuid,jsonb,text)
  rename to consume_github_pages_publication_authorization_phase4_core_v0;
revoke all on function private.consume_github_pages_publication_authorization_phase4_core_v0(uuid,jsonb,text)
  from public, anon, authenticated, service_role;

create function private.consume_github_pages_publication_authorization_v0(target_request_id uuid, observed_binding jsonb, oidc_evidence_sha256 text)
returns table (
  request_id uuid, authorization_record_id uuid, execution_identity_sha256 text, status text,
  action_manifest_sha256 text, artifact_id bigint, run_id bigint, workflow_run_id bigint, run_attempt integer,
  target text, deploy_executor_sha text, palisade_decision_id uuid, palisade_decision_sha256 text,
  conduit_invocation_id uuid, conduit_invocation_sha256 text, governed_invocation_sha256 text,
  consumed_at timestamptz, consumption_receipt_sha256 text, terminal_failure_code text, deployment_permit boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth private.github_pages_publication_authorizations_v0%rowtype;
  v_decision private.github_pages_palisade_decisions_v0%rowtype;
  v_invocation private.github_pages_conduit_invocations_v0%rowtype;
  v_phase5 jsonb := observed_binding->'phase5';
  v_core record;
  v_receipt_object jsonb;
  v_receipt_sha text;
  v_failure text;
begin
  select a.* into v_auth from private.github_pages_publication_authorizations_v0 as a where a.request_id=target_request_id for update;
  if not found then raise exception 'unknown_request_id'; end if;
  if v_auth.status <> 'authorized' then
    return query select v_auth.request_id,v_auth.request_id,v_auth.execution_identity_sha256,v_auth.status,
      v_auth.action_manifest_sha256,v_auth.artifact_id,v_auth.run_id,v_auth.run_id,v_auth.run_attempt,v_auth.canonical_public_target,
      v_auth.deploy_action_commit_sha,null::uuid,null::text,null::uuid,null::text,null::text,v_auth.consumed_at,null::text,
      'replay_or_non_authorized_state'::text,false;
    return;
  end if;
  begin
    select d.* into strict v_decision from private.github_pages_palisade_decisions_v0 as d
      where d.palisade_decision_id=(v_phase5->>'palisade_decision_id')::uuid
        and d.palisade_decision_sha256=v_phase5->>'palisade_decision_sha256';
    select i.* into strict v_invocation from private.github_pages_conduit_invocations_v0 as i
      where i.conduit_invocation_id=(v_phase5->>'conduit_invocation_id')::uuid
        and i.conduit_invocation_sha256=v_phase5->>'conduit_invocation_sha256'
        and i.governed_invocation_sha256=v_phase5->>'governed_invocation_sha256';
    if v_decision.decision<>'allow' or not v_decision.allowed or v_decision.request_id<>v_auth.request_id
      or v_invocation.state<>'dispatching' or v_invocation.request_id<>v_auth.request_id
      or v_invocation.palisade_decision_id<>v_decision.palisade_decision_id
      or v_invocation.execution_identity_sha256<>v_auth.execution_identity_sha256
      or v_invocation.action_manifest_sha256<>v_auth.action_manifest_sha256 then
      v_failure := 'phase5_binding_mismatch';
    end if;
  exception when others then
    v_failure := 'phase5_binding_missing';
  end;
  if v_failure is not null then
    perform pg_catalog.set_config('private.github_pages_publication_authorization_write_v0','enabled',true);
    perform pg_catalog.set_config('private.github_pages_publication_authorization_event_v0','enabled',true);
    update private.github_pages_publication_authorizations_v0 as a set status='consumption_failed',
      terminal_failure_code=v_failure,terminal_failure_detail='Phase 5 same-invocation binding failed closed',
      consumption_oidc_evidence_sha256=oidc_evidence_sha256 where a.request_id=target_request_id and a.status='authorized'
      returning * into strict v_auth;
    insert into private.github_pages_publication_authorization_events_v0(request_id,event_type,from_status,to_status,actor_kind,actor_reference,evidence)
    values(target_request_id,'consumption_failed','authorized','consumption_failed','conduit_phase5','fixed_pages_transport',
      pg_catalog.jsonb_build_object('failure_code',v_failure));
    return query select v_auth.request_id,v_auth.request_id,v_auth.execution_identity_sha256,v_auth.status,
      v_auth.action_manifest_sha256,v_auth.artifact_id,v_auth.run_id,v_auth.run_id,v_auth.run_attempt,v_auth.canonical_public_target,
      v_auth.deploy_action_commit_sha,null::uuid,null::text,null::uuid,null::text,null::text,v_auth.consumed_at,null::text,v_failure,false;
    return;
  end if;
  select * into strict v_core from private.consume_github_pages_publication_authorization_phase4_core_v0(target_request_id,observed_binding,oidc_evidence_sha256);
  select a.* into strict v_auth from private.github_pages_publication_authorizations_v0 as a where a.request_id=target_request_id;
  if v_core.status <> 'consumed' or v_core.deployment_permit is not true then
    return query select v_auth.request_id,v_auth.request_id,v_auth.execution_identity_sha256,v_auth.status,
      v_auth.action_manifest_sha256,v_auth.artifact_id,v_auth.run_id,v_auth.run_id,v_auth.run_attempt,v_auth.canonical_public_target,
      v_auth.deploy_action_commit_sha,v_decision.palisade_decision_id,v_decision.palisade_decision_sha256,
      v_invocation.conduit_invocation_id,v_invocation.conduit_invocation_sha256,v_invocation.governed_invocation_sha256,
      v_auth.consumed_at,null::text,v_core.terminal_failure_code,false;
    return;
  end if;
  v_receipt_object := pg_catalog.jsonb_build_object(
    'request_id',v_auth.request_id,'authorization_record_id',v_auth.request_id,'execution_identity_sha256',v_auth.execution_identity_sha256,
    'action_manifest_sha256',v_auth.action_manifest_sha256,'artifact_id',v_auth.artifact_id::text,'run_id',v_auth.run_id::text,
    'run_attempt',v_auth.run_attempt,'target',v_auth.canonical_public_target,'deploy_executor_sha',v_auth.deploy_action_commit_sha,
    'palisade_decision_id',v_decision.palisade_decision_id,'palisade_decision_sha256',v_decision.palisade_decision_sha256,
    'conduit_invocation_id',v_invocation.conduit_invocation_id,'conduit_invocation_sha256',v_invocation.conduit_invocation_sha256,
    'governed_invocation_sha256',v_invocation.governed_invocation_sha256,'consumed_at',v_auth.consumed_at,'deployment_permit',true
  );
  v_receipt_sha := private.github_pages_canonical_sha256_v0(v_receipt_object);
  perform pg_catalog.set_config('private.github_pages_publication_authorization_write_v0','enabled',true);
  perform pg_catalog.set_config('private.github_pages_phase5_consumption_finalize_v0','enabled',true);
  perform pg_catalog.set_config('private.github_pages_publication_authorization_event_v0','enabled',true);
  update private.github_pages_publication_authorizations_v0 as a set
    consumption_palisade_decision_id=v_decision.palisade_decision_id,
    consumption_palisade_decision_sha256=v_decision.palisade_decision_sha256,
    consumption_conduit_invocation_id=v_invocation.conduit_invocation_id,
    consumption_conduit_invocation_sha256=v_invocation.conduit_invocation_sha256,
    consumption_governed_invocation_sha256=v_invocation.governed_invocation_sha256,
    phase5_consumption_receipt_sha256=v_receipt_sha
    where a.request_id=target_request_id and a.status='consumed' returning * into strict v_auth;
  insert into private.github_pages_publication_authorization_events_v0(request_id,event_type,from_status,to_status,actor_kind,actor_reference,evidence)
  values(target_request_id,'phase5_consumption_bound','consumed','consumed','conduit_phase5',v_invocation.conduit_invocation_id::text,
    pg_catalog.jsonb_build_object('palisade_decision_id',v_decision.palisade_decision_id,
      'conduit_invocation_id',v_invocation.conduit_invocation_id,'consumption_receipt_sha256',v_receipt_sha));
  return query select v_auth.request_id,v_auth.request_id,v_auth.execution_identity_sha256,v_auth.status,
    v_auth.action_manifest_sha256,v_auth.artifact_id,v_auth.run_id,v_auth.run_id,v_auth.run_attempt,v_auth.canonical_public_target,
    v_auth.deploy_action_commit_sha,v_decision.palisade_decision_id,v_decision.palisade_decision_sha256,
    v_invocation.conduit_invocation_id,v_invocation.conduit_invocation_sha256,v_invocation.governed_invocation_sha256,
    v_auth.consumed_at,v_receipt_sha,null::text,true;
end;
$$;

create trigger enforce_github_pages_palisade_decision_v0_trigger
before insert or update or delete on private.github_pages_palisade_decisions_v0
for each row execute function private.enforce_github_pages_palisade_decision_v0();

create or replace function private.enforce_github_pages_conduit_invocation_v0()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('private.github_pages_conduit_invocation_write_v0', true) <> 'enabled' then
    raise exception 'direct Conduit invocation mutation prohibited';
  end if;
  if tg_op = 'DELETE' then raise exception 'Conduit invocation deletion prohibited'; end if;
  if tg_op = 'INSERT' then return new; end if;
  if old.conduit_invocation_id is distinct from new.conduit_invocation_id
    or old.palisade_decision_id is distinct from new.palisade_decision_id
    or old.palisade_decision_sha256 is distinct from new.palisade_decision_sha256
    or old.request_id is distinct from new.request_id
    or old.execution_identity_sha256 is distinct from new.execution_identity_sha256
    or old.action_manifest_sha256 is distinct from new.action_manifest_sha256
    or old.governed_invocation_sha256 is distinct from new.governed_invocation_sha256
    or old.conduit_invocation_sha256 is distinct from new.conduit_invocation_sha256
    or old.action_envelope is distinct from new.action_envelope
  then raise exception 'bound Conduit invocation evidence is immutable'; end if;
  if old.state in ('policy_blocked','consumed','consumption_failed','infrastructure_failed','result_validation_failed') then
    raise exception 'terminal Conduit invocation is immutable';
  end if;
  if not ((old.state = 'created' and new.state in ('dispatching','policy_blocked','infrastructure_failed','result_validation_failed'))
    or (old.state = 'dispatching' and new.state in ('consumed','consumption_failed','infrastructure_failed','result_validation_failed'))) then
    raise exception 'prohibited Conduit transition % -> %', old.state, new.state;
  end if;
  return new;
end;
$$;

create trigger enforce_github_pages_conduit_invocation_v0_trigger
before insert or update or delete on private.github_pages_conduit_invocations_v0
for each row execute function private.enforce_github_pages_conduit_invocation_v0();

create or replace function private.github_pages_phase5_status_receipt_v0(target_request_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row private.github_pages_publication_authorizations_v0%rowtype;
  v_operator record;
  v_count integer := 0;
  v_operator_valid boolean := false;
  v_now timestamptz := pg_catalog.transaction_timestamp();
begin
  select a.* into strict v_row from private.github_pages_publication_authorizations_v0 as a where a.request_id = target_request_id;
  begin
    select * into strict v_operator from private.resolve_github_pages_operator_cardinality_v0();
    v_count := v_operator.assignment_count;
    v_operator_valid := v_count = 1
      and v_operator.operator_principal_id is not distinct from v_row.authorizer_operator_principal_id
      and v_operator.authenticated_user_id is not distinct from v_row.authorizer_user_id
      and v_operator.workspace_id is not distinct from v_row.workspace_id
      and v_operator.status is not distinct from 'active';
  exception when others then
    v_count := 0;
    v_operator_valid := false;
  end;
  return pg_catalog.jsonb_build_object(
    'schema_version','0.5','request_id',v_row.request_id,'authorization_record_id',v_row.request_id,
    'execution_identity_sha256',v_row.execution_identity_sha256,'action_manifest_sha256',v_row.action_manifest_sha256,
    'status',v_row.status,'request_expires_at',v_row.request_expires_at,'issued_at',v_row.issued_at,
    'not_before',v_row.not_before,'expires_at',v_row.expires_at,'decision_at',v_row.decision_at,
    'terminal_failure_code',v_row.terminal_failure_code,'authorization_currently_usable',
      (v_row.status='authorized' and v_row.not_before <= v_now and v_now < v_row.expires_at and v_now < v_row.artifact_expires_at and v_operator_valid),
    'operator_assignment_count',v_count,'approved_operator_still_valid',v_operator_valid,
    'artifact_expires_at',v_row.artifact_expires_at,'artifact_id',v_row.artifact_id,'run_id',v_row.run_id,
    'run_attempt',v_row.run_attempt,'target',v_row.canonical_public_target,'deploy_executor_sha',v_row.deploy_action_commit_sha
  );
end;
$$;

create or replace function private.resolve_github_pages_publication_authorization_phase5_v0(target_request_id uuid, manifest_sha256 text)
returns table (
  request_id uuid, status text, action_manifest_sha256 text, request_expires_at timestamptz,
  issued_at timestamptz, not_before timestamptz, expires_at timestamptz, decision_at timestamptz,
  terminal_failure_code text, authorization_record_id uuid, execution_identity_sha256 text,
  authorization_currently_usable boolean, phase4_status_receipt_sha256 text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status record;
  v_receipt jsonb;
begin
  select * into strict v_status from private.resolve_github_pages_publication_authorization_v0(target_request_id, manifest_sha256);
  v_receipt := private.github_pages_phase5_status_receipt_v0(target_request_id);
  return query select v_status.request_id,v_status.status,v_status.action_manifest_sha256,v_status.request_expires_at,
    v_status.issued_at,v_status.not_before,v_status.expires_at,v_status.decision_at,v_status.terminal_failure_code,
    v_status.request_id,v_receipt->>'execution_identity_sha256',(v_receipt->>'authorization_currently_usable')::boolean,
    private.github_pages_canonical_sha256_v0(v_receipt);
end;
$$;

create or replace function private.evaluate_github_pages_palisade_v0(
  target_request_id uuid,
  expected_manifest_sha256 text,
  expected_status_receipt_sha256 text,
  oidc_evidence_sha256 text
)
returns table (
  schema_version text, palisade_decision_id uuid, policy_surface text, claim_id text, requested_action text,
  action_identifier text, policy_rule_id text, policy_rule_sha256 text, request_id uuid, authorization_record_id uuid,
  execution_identity_sha256 text, action_manifest_sha256 text, policy_input_sha256 text,
  phase4_status_receipt_sha256 text, decision text, allowed boolean, reason_codes jsonb,
  required_evidence jsonb, missing_evidence jsonb, evaluated_at timestamptz, palisade_decision_sha256 text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row private.github_pages_publication_authorizations_v0%rowtype;
  v_status jsonb;
  v_status_sha text;
  v_input jsonb;
  v_input_sha text;
  v_decision text;
  v_reasons jsonb;
  v_required jsonb := '["phase4_status","operator_cardinality","request_identity","execution_identity","manifest","artifact","runtime","dependencies","target_effect_executor","replay","consumption"]'::jsonb;
  v_missing jsonb := '[]'::jsonb;
  v_id uuid := extensions.gen_random_uuid();
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_decision_object jsonb;
  v_decision_sha text;
  v_existing private.github_pages_palisade_decisions_v0%rowtype;
begin
  if oidc_evidence_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'OIDC evidence digest invalid'; end if;
  select a.* into strict v_row from private.github_pages_publication_authorizations_v0 as a where a.request_id=target_request_id;
  v_status := private.github_pages_phase5_status_receipt_v0(target_request_id);
  v_status_sha := private.github_pages_canonical_sha256_v0(v_status);
  v_input := pg_catalog.jsonb_build_object(
    'schema_version','0.5','policy_surface','github_pages_outward_publication_boundary',
    'claim_id','github_pages_outward_publication_authority','requested_action','github_pages_outward_publication@0.1',
    'policy_rule_id','github-pages-outward-publication-authority-v0','action_identifier',v_row.action_identifier,
    'workspace_id',v_row.workspace_id,'repository',v_row.repository,'repository_id',v_row.repository_id::text,
    'repository_ref',v_row.repository_ref,'workflow_path',v_row.workflow_path,'workflow_sha',v_row.workflow_sha,
    'workflow_run_id',v_row.run_id::text,'run_attempt',v_row.run_attempt,'request_id',v_row.request_id,
    'authorization_record_id',v_row.request_id,'execution_identity_sha256',v_row.execution_identity_sha256,
    'action_manifest_sha256',v_row.action_manifest_sha256,'artifact_id',v_row.artifact_id::text,
    'artifact_name',v_row.artifact_name,'artifact_run_id',v_row.artifact_run_id::text,
    'artifact_run_attempt',v_row.artifact_run_attempt,'built_artifact_sha256',v_row.built_artifact_sha256,
    'canonical_public_target',v_row.canonical_public_target,'environment',v_row.environment_name,
    'permitted_effect',v_row.permitted_effect,'deploy_executor_sha',v_row.deploy_action_commit_sha,
    'phase4_status',v_row.status,'phase4_status_receipt_sha256',v_status_sha,
    'authorization_currently_usable',(v_status->>'authorization_currently_usable')::boolean,
    'authorization_expired',(v_row.expires_at is not null and v_now >= v_row.expires_at),
    'artifact_expired',(v_now >= v_row.artifact_expires_at),
    'operator_assignment_count',(v_status->>'operator_assignment_count')::integer,
    'operator_cardinality_exactly_one',((v_status->>'operator_assignment_count')::integer = 1),
    'approved_operator_still_valid',(v_status->>'approved_operator_still_valid')::boolean,
    'request_identity_match',(v_row.request_id = target_request_id),
    'execution_identity_match',(v_row.execution_identity_sha256 = private.github_pages_publication_execution_identity_v0(v_row.action_manifest)),
    'manifest_digest_match',(v_row.action_manifest_sha256 = expected_manifest_sha256),
    'artifact_binding_match',(v_row.artifact_id::text = v_row.action_manifest->>'artifact_id' and v_row.built_artifact_sha256 = v_row.action_manifest->>'built_artifact_sha256'),
    'runtime_binding_match',(v_row.workflow_sha = v_row.action_manifest->>'workflow_sha' and v_row.run_id::text = v_row.action_manifest->>'run_id'),
    'dependency_binding_match',(v_row.upload_action_commit_sha = v_row.action_manifest->>'upload_action_commit_sha'),
    'target_effect_executor_match',(v_row.canonical_public_target='https://camilocarlone.com/' and v_row.deploy_action_commit_sha='d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e'),
    'replay_state',(case when v_row.status='consumed' then 'used' else 'unused' end),
    'consumption_state',(case when v_row.status='consumed' then 'consumed' when v_row.status='consumption_failed' then 'failed' else 'not_consumed' end)
  );
  v_input_sha := private.github_pages_canonical_sha256_v0(v_input);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_input_sha, 0));
  select d.* into v_existing from private.github_pages_palisade_decisions_v0 as d
    where d.policy_input_sha256=v_input_sha and d.phase4_status_receipt_sha256=v_status_sha;
  if found then
    return query select v_existing.schema_version,v_existing.palisade_decision_id,v_existing.policy_surface,v_existing.claim_id,
      v_existing.requested_action,v_existing.action_identifier,v_existing.policy_rule_id,v_existing.policy_rule_sha256,
      v_existing.request_id,v_existing.authorization_record_id,v_existing.execution_identity_sha256,
      v_existing.action_manifest_sha256,v_existing.policy_input_sha256,v_existing.phase4_status_receipt_sha256,
      v_existing.decision,v_existing.allowed,v_existing.reason_codes,v_existing.required_evidence,v_existing.missing_evidence,
      v_existing.evaluated_at,v_existing.palisade_decision_sha256;
    return;
  end if;
  if expected_status_receipt_sha256 is null or expected_manifest_sha256 is null then
    v_decision := 'requires_evidence'; v_reasons := '["mandatory_phase4_evidence_missing"]'::jsonb; v_missing := '["phase4_status_receipt_or_manifest_digest"]'::jsonb;
  elsif v_row.status = 'pending' then
    v_decision := 'requires_operator_review'; v_reasons := '["phase4_operator_decision_pending"]'::jsonb; v_missing := '["operator_decision"]'::jsonb;
  elsif expected_status_receipt_sha256 is distinct from v_status_sha or expected_manifest_sha256 is distinct from v_row.action_manifest_sha256 then
    v_decision := 'deny'; v_reasons := '["phase4_binding_mismatch"]'::jsonb;
  elsif v_row.status = 'authorized' and (v_status->>'authorization_currently_usable')::boolean
    and (v_status->>'operator_assignment_count')::integer = 1 and (v_status->>'approved_operator_still_valid')::boolean
    and v_row.execution_identity_sha256 = private.github_pages_publication_execution_identity_v0(v_row.action_manifest)
    and v_now < v_row.expires_at and v_now < v_row.artifact_expires_at then
    v_decision := 'allow'; v_reasons := '["all_mandatory_policy_predicates_established"]'::jsonb;
  else
    v_decision := 'deny'; v_reasons := pg_catalog.jsonb_build_array('phase4_status_or_policy_predicate_failed');
  end if;
  v_decision_object := pg_catalog.jsonb_build_object(
    'schema_version','0.5','palisade_decision_id',v_id,'policy_surface','github_pages_outward_publication_boundary',
    'claim_id','github_pages_outward_publication_authority','requested_action','github_pages_outward_publication@0.1',
    'action_identifier','github_pages_outward_publication@0.1','policy_rule_id','github-pages-outward-publication-authority-v0',
    'policy_rule_sha256','401562bd846271357e4e250f68da5b757e20aacc8005f5a2eb73cd0f989cb18b',
    'request_id',v_row.request_id,'authorization_record_id',v_row.request_id,
    'execution_identity_sha256',v_row.execution_identity_sha256,'action_manifest_sha256',v_row.action_manifest_sha256,
    'policy_input_sha256',v_input_sha,'phase4_status_receipt_sha256',v_status_sha,'decision',v_decision,
    'allowed',(v_decision='allow'),'reason_codes',v_reasons,'required_evidence',v_required,'missing_evidence',v_missing,
    'evaluated_at',v_now
  );
  v_decision_sha := private.github_pages_canonical_sha256_v0(v_decision_object);
  perform pg_catalog.set_config('private.github_pages_palisade_decision_write_v0','enabled',true);
  insert into private.github_pages_palisade_decisions_v0(
    palisade_decision_id,schema_version,request_id,authorization_record_id,execution_identity_sha256,action_manifest_sha256,
    policy_bundle_id,policy_bundle_version,policy_rule_id,policy_rule_sha256,policy_surface,claim_id,requested_action,
    action_identifier,policy_input,policy_input_sha256,decision,allowed,reason_codes,required_evidence,missing_evidence,
    phase4_status,phase4_status_receipt_sha256,workspace_id,repository_id,workflow_run_id,run_attempt,artifact_id,target,
    deploy_executor_sha,evaluated_at,palisade_decision_sha256
  ) values (
    v_id,'0.5',v_row.request_id,v_row.request_id,v_row.execution_identity_sha256,v_row.action_manifest_sha256,
    'palisade-policy-bundle.v0','0.5.0','github-pages-outward-publication-authority-v0',
    '401562bd846271357e4e250f68da5b757e20aacc8005f5a2eb73cd0f989cb18b',
    'github_pages_outward_publication_boundary','github_pages_outward_publication_authority',
    'github_pages_outward_publication@0.1','github_pages_outward_publication@0.1',v_input,v_input_sha,v_decision,
    v_decision='allow',v_reasons,v_required,v_missing,v_row.status,v_status_sha,v_row.workspace_id,v_row.repository_id,
    v_row.run_id,v_row.run_attempt,v_row.artifact_id,v_row.canonical_public_target,v_row.deploy_action_commit_sha,v_now,v_decision_sha
  );
  return query select '0.5',v_id,'github_pages_outward_publication_boundary','github_pages_outward_publication_authority',
    'github_pages_outward_publication@0.1','github_pages_outward_publication@0.1',
    'github-pages-outward-publication-authority-v0','401562bd846271357e4e250f68da5b757e20aacc8005f5a2eb73cd0f989cb18b',
    v_row.request_id,v_row.request_id,v_row.execution_identity_sha256,v_row.action_manifest_sha256,v_input_sha,v_status_sha,
    v_decision,(v_decision='allow'),v_reasons,v_required,v_missing,v_now,v_decision_sha;
end;
$$;

create or replace function private.record_github_pages_palisade_runtime_unavailable_v0(
  target_request_id uuid,
  failure_code text,
  oidc_evidence_sha256 text
)
returns table (
  schema_version text, palisade_decision_id uuid, policy_surface text, claim_id text, requested_action text,
  action_identifier text, policy_rule_id text, policy_rule_sha256 text, request_id uuid, authorization_record_id uuid,
  execution_identity_sha256 text, action_manifest_sha256 text, policy_input_sha256 text,
  phase4_status_receipt_sha256 text, decision text, allowed boolean, reason_codes jsonb,
  required_evidence jsonb, missing_evidence jsonb, evaluated_at timestamptz, palisade_decision_sha256 text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row private.github_pages_publication_authorizations_v0%rowtype;
  v_status jsonb;
  v_status_sha text;
  v_input jsonb;
  v_input_sha text;
  v_reasons jsonb;
  v_required jsonb := '["phase4_status","palisade_runtime","decision_persistence"]'::jsonb;
  v_missing jsonb;
  v_id uuid := extensions.gen_random_uuid();
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_decision_object jsonb;
  v_decision_sha text;
  v_existing private.github_pages_palisade_decisions_v0%rowtype;
begin
  if failure_code not in (
    'phase4_status_unavailable','palisade_evaluator_unavailable','palisade_persistence_unavailable',
    'required_evidence_unreadable','digest_computation_failed'
  ) then raise exception 'unsupported Palisade runtime failure code'; end if;
  if oidc_evidence_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'OIDC evidence digest invalid'; end if;
  select a.* into strict v_row from private.github_pages_publication_authorizations_v0 as a
    where a.request_id=target_request_id;
  v_status := private.github_pages_phase5_status_receipt_v0(target_request_id);
  v_status_sha := private.github_pages_canonical_sha256_v0(v_status);
  v_reasons := pg_catalog.jsonb_build_array(failure_code);
  v_missing := pg_catalog.jsonb_build_array(failure_code);
  v_input := pg_catalog.jsonb_build_object(
    'schema_version','0.5','policy_surface','github_pages_outward_publication_boundary',
    'claim_id','github_pages_outward_publication_authority','requested_action','github_pages_outward_publication@0.1',
    'policy_rule_id','github-pages-outward-publication-authority-v0','action_identifier',v_row.action_identifier,
    'request_id',v_row.request_id,'authorization_record_id',v_row.request_id,
    'execution_identity_sha256',v_row.execution_identity_sha256,'action_manifest_sha256',v_row.action_manifest_sha256,
    'phase4_status',v_row.status,'phase4_status_receipt_sha256',v_status_sha,
    'runtime_failure_code',failure_code,'oidc_evidence_sha256',oidc_evidence_sha256
  );
  v_input_sha := private.github_pages_canonical_sha256_v0(v_input);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_input_sha, 0));
  select d.* into v_existing from private.github_pages_palisade_decisions_v0 as d
    where d.policy_input_sha256=v_input_sha and d.phase4_status_receipt_sha256=v_status_sha;
  if found then
    return query select v_existing.schema_version,v_existing.palisade_decision_id,v_existing.policy_surface,v_existing.claim_id,
      v_existing.requested_action,v_existing.action_identifier,v_existing.policy_rule_id,v_existing.policy_rule_sha256,
      v_existing.request_id,v_existing.authorization_record_id,v_existing.execution_identity_sha256,
      v_existing.action_manifest_sha256,v_existing.policy_input_sha256,v_existing.phase4_status_receipt_sha256,
      v_existing.decision,v_existing.allowed,v_existing.reason_codes,v_existing.required_evidence,v_existing.missing_evidence,
      v_existing.evaluated_at,v_existing.palisade_decision_sha256;
    return;
  end if;
  v_decision_object := pg_catalog.jsonb_build_object(
    'schema_version','0.5','palisade_decision_id',v_id,'policy_surface','github_pages_outward_publication_boundary',
    'claim_id','github_pages_outward_publication_authority','requested_action','github_pages_outward_publication@0.1',
    'action_identifier','github_pages_outward_publication@0.1','policy_rule_id','github-pages-outward-publication-authority-v0',
    'policy_rule_sha256','401562bd846271357e4e250f68da5b757e20aacc8005f5a2eb73cd0f989cb18b',
    'request_id',v_row.request_id,'authorization_record_id',v_row.request_id,
    'execution_identity_sha256',v_row.execution_identity_sha256,'action_manifest_sha256',v_row.action_manifest_sha256,
    'policy_input_sha256',v_input_sha,'phase4_status_receipt_sha256',v_status_sha,
    'decision','runtime_enforcement_unavailable','allowed',false,'reason_codes',v_reasons,
    'required_evidence',v_required,'missing_evidence',v_missing,'evaluated_at',v_now
  );
  v_decision_sha := private.github_pages_canonical_sha256_v0(v_decision_object);
  perform pg_catalog.set_config('private.github_pages_palisade_decision_write_v0','enabled',true);
  insert into private.github_pages_palisade_decisions_v0(
    palisade_decision_id,schema_version,request_id,authorization_record_id,execution_identity_sha256,action_manifest_sha256,
    policy_bundle_id,policy_bundle_version,policy_rule_id,policy_rule_sha256,policy_surface,claim_id,requested_action,
    action_identifier,policy_input,policy_input_sha256,decision,allowed,reason_codes,required_evidence,missing_evidence,
    phase4_status,phase4_status_receipt_sha256,workspace_id,repository_id,workflow_run_id,run_attempt,artifact_id,target,
    deploy_executor_sha,evaluated_at,palisade_decision_sha256
  ) values (
    v_id,'0.5',v_row.request_id,v_row.request_id,v_row.execution_identity_sha256,v_row.action_manifest_sha256,
    'palisade-policy-bundle.v0','0.5.0','github-pages-outward-publication-authority-v0',
    '401562bd846271357e4e250f68da5b757e20aacc8005f5a2eb73cd0f989cb18b',
    'github_pages_outward_publication_boundary','github_pages_outward_publication_authority',
    'github_pages_outward_publication@0.1','github_pages_outward_publication@0.1',v_input,v_input_sha,
    'runtime_enforcement_unavailable',false,v_reasons,v_required,v_missing,v_row.status,v_status_sha,v_row.workspace_id,
    v_row.repository_id,v_row.run_id,v_row.run_attempt,v_row.artifact_id,v_row.canonical_public_target,
    v_row.deploy_action_commit_sha,v_now,v_decision_sha
  );
  return query select '0.5',v_id,'github_pages_outward_publication_boundary','github_pages_outward_publication_authority',
    'github_pages_outward_publication@0.1','github_pages_outward_publication@0.1',
    'github-pages-outward-publication-authority-v0','401562bd846271357e4e250f68da5b757e20aacc8005f5a2eb73cd0f989cb18b',
    v_row.request_id,v_row.request_id,v_row.execution_identity_sha256,v_row.action_manifest_sha256,v_input_sha,v_status_sha,
    'runtime_enforcement_unavailable',false,v_reasons,v_required,v_missing,v_now,v_decision_sha;
end;
$$;

alter function private.github_pages_canonical_json_v0(jsonb) owner to postgres;
alter function private.github_pages_canonical_sha256_v0(jsonb) owner to postgres;
alter function private.enforce_github_pages_palisade_decision_v0() owner to postgres;
alter function private.enforce_github_pages_conduit_invocation_v0() owner to postgres;
alter function private.github_pages_phase5_status_receipt_v0(uuid) owner to postgres;
alter function private.resolve_github_pages_publication_authorization_phase5_v0(uuid,text) owner to postgres;
alter function private.evaluate_github_pages_palisade_v0(uuid,text,text,text) owner to postgres;
alter function private.record_github_pages_palisade_runtime_unavailable_v0(uuid,text,text) owner to postgres;
alter function private.prepare_github_pages_conduit_invocation_v0(jsonb,text) owner to postgres;
alter function private.consume_github_pages_publication_authorization_v0(uuid,jsonb,text) owner to postgres;
alter function private.fail_github_pages_conduit_invocation_v0(uuid,text) owner to postgres;
alter function private.complete_github_pages_conduit_invocation_v0(uuid,jsonb) owner to postgres;

revoke all on function private.github_pages_canonical_json_v0(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.github_pages_canonical_sha256_v0(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.enforce_github_pages_palisade_decision_v0() from public, anon, authenticated, service_role;
revoke all on function private.enforce_github_pages_conduit_invocation_v0() from public, anon, authenticated, service_role;
revoke all on function private.github_pages_phase5_status_receipt_v0(uuid) from public, anon, authenticated, service_role;
revoke all on function private.resolve_github_pages_publication_authorization_phase5_v0(uuid,text) from public, anon, authenticated;
revoke all on function private.evaluate_github_pages_palisade_v0(uuid,text,text,text) from public, anon, authenticated;
revoke all on function private.record_github_pages_palisade_runtime_unavailable_v0(uuid,text,text) from public, anon, authenticated;
revoke all on function private.prepare_github_pages_conduit_invocation_v0(jsonb,text) from public, anon, authenticated;
revoke all on function private.consume_github_pages_publication_authorization_v0(uuid,jsonb,text) from public, anon, authenticated;
revoke all on function private.fail_github_pages_conduit_invocation_v0(uuid,text) from public, anon, authenticated;
revoke all on function private.complete_github_pages_conduit_invocation_v0(uuid,jsonb) from public, anon, authenticated;

grant execute on function private.resolve_github_pages_publication_authorization_phase5_v0(uuid,text) to service_role;
grant execute on function private.evaluate_github_pages_palisade_v0(uuid,text,text,text) to service_role;
grant execute on function private.record_github_pages_palisade_runtime_unavailable_v0(uuid,text,text) to service_role;
grant execute on function private.prepare_github_pages_conduit_invocation_v0(jsonb,text) to service_role;
grant execute on function private.consume_github_pages_publication_authorization_v0(uuid,jsonb,text) to service_role;
grant execute on function private.fail_github_pages_conduit_invocation_v0(uuid,text) to service_role;
grant execute on function private.complete_github_pages_conduit_invocation_v0(uuid,jsonb) to service_role;
