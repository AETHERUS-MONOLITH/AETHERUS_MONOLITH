-- Phase 4 corrective closure for github_pages_outward_publication@0.1 only.
-- This migration adds no generalized authorization primitive or public API.

create or replace function private.github_pages_publication_execution_identity_v0(manifest jsonb)
returns text
language sql
immutable
strict
security definer
set search_path = ''
as $$
  select private.github_pages_publication_sha256_v0(
    pg_catalog.jsonb_build_object(
      'action_identifier', manifest->>'action_identifier',
      'workspace_id', manifest->>'workspace_id',
      'repository', manifest->>'repository',
      'repository_id', manifest->>'repository_id',
      'repository_ref', manifest->>'ref',
      'workflow_path', manifest->>'workflow_path',
      'workflow_sha', manifest->>'workflow_sha',
      'workflow_run_id', manifest->>'run_id',
      'run_attempt', manifest->>'run_attempt',
      'uploaded_artifact_id', manifest->>'artifact_id',
      'uploaded_artifact_name', manifest->>'artifact_name',
      'environment', manifest->>'environment_name',
      'canonical_public_target', manifest->>'canonical_public_target',
      'deploy_executor_sha', manifest->>'deploy_action_commit_sha'
    )::text
  );
$$;

alter function private.github_pages_publication_execution_identity_v0(jsonb) owner to postgres;
revoke all on function private.github_pages_publication_execution_identity_v0(jsonb) from public, anon, authenticated, service_role;

alter table private.github_pages_publication_authorizations_v0
  add column execution_identity_sha256 text;

update private.github_pages_publication_authorizations_v0
set execution_identity_sha256 = private.github_pages_publication_execution_identity_v0(action_manifest);

alter table private.github_pages_publication_authorizations_v0
  alter column execution_identity_sha256 set not null,
  add constraint github_pages_pub_auth_v0_execution_identity_ck
    check (execution_identity_sha256 ~ '^[0-9a-f]{64}$');

alter table private.github_pages_publication_authorizations_v0
  drop constraint github_pages_publication_authorizations_v0_request_key_unique;

drop index private.github_pages_publication_authorizations_v0_replay_tuple_uidx;

alter table private.github_pages_publication_authorizations_v0
  add constraint github_pages_pub_auth_v0_execution_identity_unique
  unique (execution_identity_sha256);

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
  if old.status in ('rejected','consumed','consumption_failed','expired') then raise exception 'terminal authorization state is immutable'; end if;
  if not ((old.status = 'pending' and new.status in ('authorized','rejected','expired')) or (old.status = 'authorized' and new.status in ('consumed','consumption_failed','expired'))) then
    raise exception 'prohibited authorization transition % -> %', old.status, new.status;
  end if;
  if old.expires_at is not null and new.expires_at > old.expires_at then raise exception 'authorization expiry extension prohibited'; end if;
  new.updated_at := pg_catalog.transaction_timestamp();
  return new;
end;
$$;

create or replace function private.create_github_pages_publication_authorization_v0(manifest jsonb, manifest_sha256 text, request_key_sha256 text)
returns table (request_id uuid, status text, action_manifest_sha256 text, request_expires_at timestamptz, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_request_id uuid := extensions.gen_random_uuid();
  v_execution_identity text;
  v_row private.github_pages_publication_authorizations_v0%rowtype;
begin
  v_execution_identity := private.github_pages_publication_execution_identity_v0(manifest);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_execution_identity, 0));

  select a.* into v_row
  from private.github_pages_publication_authorizations_v0 as a
  where a.execution_identity_sha256 = v_execution_identity
  for update;

  if found then
    if v_row.action_manifest is distinct from manifest
      or v_row.action_manifest_sha256 is distinct from manifest_sha256
      or v_row.request_key_sha256 is distinct from request_key_sha256 then
      raise exception using
        errcode = 'P0001',
        message = 'conflicting_binding_for_execution_identity';
    end if;
    return query select v_row.request_id, v_row.status, v_row.action_manifest_sha256, v_row.request_expires_at, v_row.created_at;
    return;
  end if;

  perform private.validate_github_pages_publication_manifest_v0(manifest, manifest_sha256, request_key_sha256);
  if (manifest->>'artifact_expires_at')::timestamptz <= v_now then raise exception 'artifact_expired'; end if;

  perform pg_catalog.set_config('private.github_pages_publication_authorization_write_v0', 'enabled', true);
  insert into private.github_pages_publication_authorizations_v0 (
    request_id, execution_identity_sha256, action_identifier, workspace_id, repository, repository_id, repository_ref,
    workflow_path, workflow_name, workflow_sha, run_id, run_attempt, requester_actor, requester_actor_id,
    requester_oidc_evidence_sha256, source_commit_sha, source_tree_sha, runtime_config_evidence_sha256,
    built_artifact_sha256, operator_resolution_evidence_sha256, artifact_id, artifact_name, artifact_run_id,
    artifact_run_attempt, artifact_uploaded_at, artifact_expires_at, upload_action_repository, upload_action_commit_sha,
    deploy_action_repository, deploy_action_commit_sha, environment_name, canonical_public_target, permitted_effect,
    maximum_artifact_uploads, maximum_deployments, authorization_contract_version, action_manifest,
    action_manifest_sha256, request_key_sha256, request_expires_at
  ) values (
    v_request_id, v_execution_identity, manifest->>'action_identifier', (manifest->>'workspace_id')::uuid,
    manifest->>'repository', (manifest->>'repository_id')::bigint, manifest->>'ref', manifest->>'workflow_path',
    manifest->>'workflow_name', manifest->>'workflow_sha', (manifest->>'run_id')::bigint,
    (manifest->>'run_attempt')::integer, manifest->>'requester_actor', (manifest->>'requester_actor_id')::bigint,
    manifest->>'requester_oidc_evidence_sha256', manifest->>'source_commit_sha', manifest->>'source_tree_sha',
    manifest->>'runtime_config_evidence_sha256', manifest->>'built_artifact_sha256',
    manifest->>'operator_resolution_evidence_sha256', (manifest->>'artifact_id')::bigint, manifest->>'artifact_name',
    (manifest->>'artifact_run_id')::bigint, (manifest->>'artifact_run_attempt')::integer,
    (manifest->>'artifact_uploaded_at')::timestamptz, (manifest->>'artifact_expires_at')::timestamptz,
    manifest->>'upload_action_repository', manifest->>'upload_action_commit_sha', manifest->>'deploy_action_repository',
    manifest->>'deploy_action_commit_sha', manifest->>'environment_name', manifest->>'canonical_public_target',
    manifest->>'permitted_effect', (manifest->>'maximum_artifact_uploads')::integer,
    (manifest->>'maximum_deployments')::integer, manifest->>'authorization_contract_version', manifest,
    manifest_sha256, request_key_sha256, least(v_now + interval '900 seconds', (manifest->>'artifact_expires_at')::timestamptz)
  );

  perform pg_catalog.set_config('private.github_pages_publication_authorization_event_v0', 'enabled', true);
  insert into private.github_pages_publication_authorization_events_v0
    (request_id,event_type,from_status,to_status,actor_kind,actor_reference,evidence)
  values (
    v_request_id,'request_created',null,'pending','github_oidc_requester','AETHERUS-MONOLITH',
    pg_catalog.jsonb_build_object('action_manifest_sha256',manifest_sha256,'execution_identity_sha256',v_execution_identity)
  );

  select a.* into strict v_row
  from private.github_pages_publication_authorizations_v0 as a
  where a.request_id = v_request_id;
  return query select v_row.request_id, v_row.status, v_row.action_manifest_sha256, v_row.request_expires_at, v_row.created_at;
end;
$$;

create or replace function private.resolve_github_pages_operator_cardinality_v0()
returns table (
  assignment_count integer,
  cardinality_status text,
  operator_principal_id uuid,
  authenticated_user_id uuid,
  workspace_id uuid,
  principal_type text,
  authority_class text,
  authority_version text,
  status text,
  valid_from timestamptz,
  valid_until timestamptz,
  resolved_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with applicable as materialized (
    select assignment.*
    from private.workspace_operator_principals as assignment
    where assignment.workspace_id = '9abed891-7950-4937-a2aa-4b957d8a4bd1'::uuid
      and assignment.principal_type = 'human_operator'
      and assignment.authority_class = 'workspace_operator_principal'
      and assignment.status = 'active'
      and assignment.valid_from <= pg_catalog.transaction_timestamp()
      and (assignment.valid_until is null or pg_catalog.transaction_timestamp() < assignment.valid_until)
      and assignment.suspended_at is null
      and assignment.revoked_at is null
  ), aggregate_result as (
    select
      pg_catalog.count(*)::integer as assignment_count,
      pg_catalog.array_agg(applicable.id order by applicable.id) as ids,
      pg_catalog.array_agg(applicable.user_id order by applicable.id) as user_ids,
      pg_catalog.array_agg(applicable.workspace_id order by applicable.id) as workspace_ids,
      pg_catalog.array_agg(applicable.principal_type order by applicable.id) as principal_types,
      pg_catalog.array_agg(applicable.authority_class order by applicable.id) as authority_classes,
      pg_catalog.array_agg(applicable.authority_version order by applicable.id) as authority_versions,
      pg_catalog.array_agg(applicable.status order by applicable.id) as statuses,
      pg_catalog.array_agg(applicable.valid_from order by applicable.id) as valid_froms,
      pg_catalog.array_agg(applicable.valid_until order by applicable.id) as valid_untils
    from applicable
  )
  select
    a.assignment_count,
    case a.assignment_count when 0 then 'unresolved' when 1 then 'resolved' else 'ambiguous' end,
    case when a.assignment_count = 1 then a.ids[1] end,
    case when a.assignment_count = 1 then a.user_ids[1] end,
    case when a.assignment_count = 1 then a.workspace_ids[1] end,
    case when a.assignment_count = 1 then a.principal_types[1] end,
    case when a.assignment_count = 1 then a.authority_classes[1] end,
    case when a.assignment_count = 1 then a.authority_versions[1] end,
    case when a.assignment_count = 1 then a.statuses[1] end,
    case when a.assignment_count = 1 then a.valid_froms[1] end,
    case when a.assignment_count = 1 then a.valid_untils[1] end,
    pg_catalog.transaction_timestamp()
  from aggregate_result as a;
$$;

create or replace function private.resolve_github_pages_operator_evidence_v0()
returns table (
  operator_principal_id uuid,
  workspace_id uuid,
  principal_type text,
  authority_class text,
  authority_version text,
  status text,
  resolution_status text,
  resolved_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_operator record;
begin
  select * into strict v_operator from private.resolve_github_pages_operator_cardinality_v0();
  if v_operator.assignment_count = 0 then raise exception 'operator_assignment_unresolved'; end if;
  if v_operator.assignment_count > 1 then raise exception 'operator_assignment_ambiguous'; end if;
  if v_operator.operator_principal_id is distinct from 'e438b03c-c708-4cba-94e4-e106ee9958c4'::uuid
    or v_operator.authenticated_user_id is distinct from '4702d528-f7a7-4a04-a991-3176bec69f52'::uuid
    or v_operator.workspace_id is distinct from '9abed891-7950-4937-a2aa-4b957d8a4bd1'::uuid
    or v_operator.principal_type is distinct from 'human_operator'
    or v_operator.authority_class is distinct from 'workspace_operator_principal'
    or v_operator.authority_version is distinct from 'Operator Principal Application and Provisioning 0.1 — Phase 2B'
    or v_operator.status is distinct from 'active'
  then raise exception 'operator_mismatch'; end if;
  return query select v_operator.operator_principal_id, v_operator.workspace_id, v_operator.principal_type,
    v_operator.authority_class, v_operator.authority_version, v_operator.status, 'resolved'::text, v_operator.resolved_at;
end;
$$;

create or replace function private.decide_github_pages_publication_authorization_v0(target_request_id uuid, decision text, reason text)
returns table (request_id uuid, status text, action_manifest_sha256 text, issued_at timestamptz, not_before timestamptz, expires_at timestamptz, decision_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_row private.github_pages_publication_authorizations_v0%rowtype;
  v_operator record;
begin
  if decision not in ('authorize','reject') then raise exception 'decision must be authorize or reject'; end if;
  if auth.uid() is null then raise exception 'fixed Operator authentication required'; end if;
  select a.* into strict v_row from private.github_pages_publication_authorizations_v0 as a where a.request_id = target_request_id for update;
  if v_row.status <> 'pending' then raise exception 'authorization request is not pending'; end if;
  select * into strict v_operator from private.resolve_github_pages_operator_cardinality_v0();
  if v_operator.assignment_count = 0 then raise exception 'operator_assignment_unresolved'; end if;
  if v_operator.assignment_count > 1 then raise exception 'operator_assignment_ambiguous'; end if;
  if auth.uid() is distinct from v_operator.authenticated_user_id
    or v_operator.operator_principal_id is distinct from 'e438b03c-c708-4cba-94e4-e106ee9958c4'::uuid
    or v_operator.authenticated_user_id is distinct from '4702d528-f7a7-4a04-a991-3176bec69f52'::uuid
    or v_operator.workspace_id is distinct from '9abed891-7950-4937-a2aa-4b957d8a4bd1'::uuid
    or v_operator.principal_type is distinct from 'human_operator'
    or v_operator.authority_class is distinct from 'workspace_operator_principal'
    or v_operator.authority_version is distinct from 'Operator Principal Application and Provisioning 0.1 — Phase 2B'
    or v_operator.status is distinct from 'active'
  then raise exception 'operator_mismatch'; end if;

  perform pg_catalog.set_config('private.github_pages_publication_authorization_write_v0', 'enabled', true);
  perform pg_catalog.set_config('private.github_pages_publication_authorization_event_v0', 'enabled', true);
  if v_now >= v_row.request_expires_at then
    update private.github_pages_publication_authorizations_v0 as a
      set status='expired', terminal_failure_code='authorization_expired', terminal_failure_detail='request expired before decision'
      where a.request_id=target_request_id and a.status='pending' returning * into strict v_row;
    insert into private.github_pages_publication_authorization_events_v0(request_id,event_type,from_status,to_status,actor_kind,actor_reference,evidence)
    values(target_request_id,'expired','pending','expired','fixed_operator',v_operator.operator_principal_id::text,pg_catalog.jsonb_build_object('failure_code','authorization_expired'));
  elsif v_now >= v_row.artifact_expires_at then
    update private.github_pages_publication_authorizations_v0 as a
      set status='expired', terminal_failure_code='artifact_expired', terminal_failure_detail='artifact expired before decision'
      where a.request_id=target_request_id and a.status='pending' returning * into strict v_row;
    insert into private.github_pages_publication_authorization_events_v0(request_id,event_type,from_status,to_status,actor_kind,actor_reference,evidence)
    values(target_request_id,'expired','pending','expired','fixed_operator',v_operator.operator_principal_id::text,pg_catalog.jsonb_build_object('failure_code','artifact_expired'));
  elsif decision = 'authorize' then
    update private.github_pages_publication_authorizations_v0 as a set
      status='authorized', issued_at=v_now, not_before=v_now, expires_at=least(v_now + interval '300 seconds', a.artifact_expires_at),
      authorizer_operator_principal_id=v_operator.operator_principal_id, authorizer_user_id=v_operator.authenticated_user_id,
      authorizer_principal_type=v_operator.principal_type, authorizer_authority_class=v_operator.authority_class,
      authorizer_authority_version=v_operator.authority_version, decision_at=v_now, decision_reason=reason
    where a.request_id=target_request_id and a.status='pending' returning * into strict v_row;
    insert into private.github_pages_publication_authorization_events_v0(request_id,event_type,from_status,to_status,actor_kind,actor_reference,evidence)
    values(target_request_id,'authorized','pending','authorized','fixed_operator',v_operator.operator_principal_id::text,pg_catalog.jsonb_build_object('expires_at',v_row.expires_at));
  else
    update private.github_pages_publication_authorizations_v0 as a set
      status='rejected', authorizer_operator_principal_id=v_operator.operator_principal_id,
      authorizer_user_id=v_operator.authenticated_user_id, authorizer_principal_type=v_operator.principal_type,
      authorizer_authority_class=v_operator.authority_class, authorizer_authority_version=v_operator.authority_version,
      decision_at=v_now, decision_reason=reason, terminal_failure_code='operator_rejected',
      terminal_failure_detail=coalesce(reason,'rejected')
    where a.request_id=target_request_id and a.status='pending' returning * into strict v_row;
    insert into private.github_pages_publication_authorization_events_v0(request_id,event_type,from_status,to_status,actor_kind,actor_reference,evidence)
    values(target_request_id,'rejected','pending','rejected','fixed_operator',v_operator.operator_principal_id::text,'{}'::jsonb);
  end if;
  return query select v_row.request_id,v_row.status,v_row.action_manifest_sha256,v_row.issued_at,v_row.not_before,v_row.expires_at,v_row.decision_at;
end;
$$;

drop function private.consume_github_pages_publication_authorization_v0(uuid,jsonb,text,text,text);

create function private.consume_github_pages_publication_authorization_v0(target_request_id uuid, observed_binding jsonb, oidc_evidence_sha256 text)
returns table (
  request_id uuid,
  status text,
  action_manifest_sha256 text,
  artifact_id bigint,
  run_id bigint,
  run_attempt integer,
  consumed_at timestamptz,
  consumption_receipt_sha256 text,
  terminal_failure_code text,
  deployment_permit boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_row private.github_pages_publication_authorizations_v0%rowtype;
  v_operator record;
  v_claims jsonb;
  v_manifest jsonb;
  v_artifact_observation jsonb;
  v_artifact jsonb;
  v_run jsonb;
  v_failure text;
  v_receipt text;
begin
  if oidc_evidence_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'OIDC evidence digest invalid'; end if;
  select a.* into v_row from private.github_pages_publication_authorizations_v0 as a where a.request_id=target_request_id for update;
  if not found then raise exception 'unknown_request_id'; end if;
  if v_row.status <> 'authorized' then
    return query select v_row.request_id,v_row.status,v_row.action_manifest_sha256,v_row.artifact_id,v_row.run_id,v_row.run_attempt,
      v_row.consumed_at,null::text,'replay_or_non_authorized_state'::text,false;
    return;
  end if;

  if pg_catalog.jsonb_typeof(observed_binding) <> 'object' then
    v_failure := 'manifest_mismatch';
  else
    v_claims := observed_binding->'claims';
    v_manifest := observed_binding->'manifest';
    v_artifact_observation := observed_binding->'artifact_verification';
  end if;

  if v_failure is null and pg_catalog.jsonb_typeof(v_claims) <> 'object' then v_failure := 'requester_mismatch'; end if;
  if v_failure is null and (v_claims->>'actor' is distinct from v_row.requester_actor or v_claims->>'actor_id' is distinct from v_row.requester_actor_id::text) then v_failure := 'requester_mismatch';
  elsif v_failure is null and (v_claims->>'repository' is distinct from v_row.repository or v_claims->>'repository_id' is distinct from v_row.repository_id::text
    or v_claims->>'repository_owner' is distinct from 'AETHERUS-MONOLITH' or v_claims->>'repository_owner_id' is distinct from '264210171'
    or v_claims->>'repository_visibility' is distinct from 'public' or v_claims->>'ref' is distinct from v_row.repository_ref
    or v_claims->>'ref_type' is distinct from 'branch') then v_failure := 'repository_mismatch';
  elsif v_failure is null and (v_claims->>'workflow' is distinct from v_row.workflow_name
    or v_claims->>'workflow_ref' is distinct from (v_row.repository || '/' || v_row.workflow_path || '@' || v_row.repository_ref)
    or v_claims->>'workflow_sha' is distinct from v_row.workflow_sha
    or v_claims->>'event_name' is distinct from 'workflow_dispatch') then v_failure := 'workflow_mismatch';
  elsif v_failure is null and v_claims->>'run_id' is distinct from v_row.run_id::text then v_failure := 'run_mismatch';
  elsif v_failure is null and v_claims->>'run_attempt' is distinct from v_row.run_attempt::text then v_failure := 'run_attempt_mismatch';
  elsif v_failure is null and v_claims->>'sha' is distinct from v_row.source_commit_sha then v_failure := 'source_mismatch';
  end if;

  if v_failure is null and pg_catalog.jsonb_typeof(v_manifest) <> 'object' then v_failure := 'manifest_mismatch';
  elsif v_failure is null and (v_manifest->>'action_identifier' is distinct from v_row.action_identifier
    or v_manifest->>'schema_version' is distinct from '0.1'
    or v_manifest->>'authorization_contract_version' is distinct from v_row.authorization_contract_version
    or v_manifest->>'action_manifest_sha256' is distinct from v_row.action_manifest_sha256) then v_failure := 'manifest_mismatch';
  elsif v_failure is null and v_manifest->>'workspace_id' is distinct from v_row.workspace_id::text then v_failure := 'workspace_mismatch';
  elsif v_failure is null and (v_manifest->>'repository' is distinct from v_row.repository or v_manifest->>'repository_id' is distinct from v_row.repository_id::text
    or v_manifest->>'ref' is distinct from v_row.repository_ref) then v_failure := 'repository_mismatch';
  elsif v_failure is null and (v_manifest->>'workflow_path' is distinct from v_row.workflow_path or v_manifest->>'workflow_name' is distinct from v_row.workflow_name
    or v_manifest->>'workflow_sha' is distinct from v_row.workflow_sha) then v_failure := 'workflow_mismatch';
  elsif v_failure is null and v_manifest->>'run_id' is distinct from v_row.run_id::text then v_failure := 'run_mismatch';
  elsif v_failure is null and v_manifest->>'run_attempt' is distinct from v_row.run_attempt::text then v_failure := 'run_attempt_mismatch';
  elsif v_failure is null and (v_manifest->>'requester_actor' is distinct from v_row.requester_actor
    or v_manifest->>'requester_actor_id' is distinct from v_row.requester_actor_id::text) then v_failure := 'requester_mismatch';
  elsif v_failure is null and (v_manifest->>'source_commit_sha' is distinct from v_row.source_commit_sha
    or v_manifest->>'source_tree_sha' is distinct from v_row.source_tree_sha) then v_failure := 'source_mismatch';
  elsif v_failure is null and v_manifest->>'runtime_config_evidence_sha256' is distinct from v_row.runtime_config_evidence_sha256 then v_failure := 'runtime_config_mismatch';
  elsif v_failure is null and (v_manifest->>'artifact_id' is distinct from v_row.artifact_id::text or v_manifest->>'artifact_name' is distinct from v_row.artifact_name
    or v_manifest->>'artifact_run_id' is distinct from v_row.artifact_run_id::text or v_manifest->>'artifact_run_attempt' is distinct from v_row.artifact_run_attempt::text
    or v_manifest->>'built_artifact_sha256' is distinct from v_row.built_artifact_sha256) then v_failure := 'artifact_mismatch';
  elsif v_failure is null and (v_manifest->>'upload_action_repository' is distinct from v_row.upload_action_repository
    or v_manifest->>'upload_action_commit_sha' is distinct from v_row.upload_action_commit_sha) then v_failure := 'dependency_mismatch';
  elsif v_failure is null and v_manifest->>'canonical_public_target' is distinct from v_row.canonical_public_target then v_failure := 'target_mismatch';
  elsif v_failure is null and v_manifest->>'environment_name' is distinct from v_row.environment_name then v_failure := 'environment_mismatch';
  elsif v_failure is null and (v_manifest->>'permitted_effect' is distinct from v_row.permitted_effect
    or v_manifest->>'maximum_artifact_uploads' is distinct from v_row.maximum_artifact_uploads::text
    or v_manifest->>'maximum_deployments' is distinct from v_row.maximum_deployments::text) then v_failure := 'effect_mismatch';
  elsif v_failure is null and (v_manifest->>'deploy_action_repository' is distinct from v_row.deploy_action_repository
    or v_manifest->>'deploy_action_commit_sha' is distinct from v_row.deploy_action_commit_sha) then v_failure := 'executor_mismatch';
  elsif v_failure is null and v_manifest is distinct from v_row.action_manifest then v_failure := 'manifest_mismatch';
  end if;

  if v_failure is null then
    select * into strict v_operator from private.resolve_github_pages_operator_cardinality_v0();
    if v_operator.assignment_count = 0 then v_failure := 'operator_assignment_unresolved';
    elsif v_operator.assignment_count > 1 then v_failure := 'operator_assignment_ambiguous';
    elsif v_operator.operator_principal_id is distinct from v_row.authorizer_operator_principal_id
      or v_operator.authenticated_user_id is distinct from v_row.authorizer_user_id
      or v_operator.workspace_id is distinct from v_row.workspace_id
      or v_operator.principal_type is distinct from v_row.authorizer_principal_type
      or v_operator.authority_class is distinct from v_row.authorizer_authority_class
      or v_operator.authority_version is distinct from v_row.authorizer_authority_version then v_failure := 'operator_mismatch';
    elsif v_operator.status is distinct from 'active' then v_failure := 'operator_no_longer_valid';
    end if;
  end if;

  if v_failure is null and v_now < v_row.not_before then v_failure := 'authorization_not_yet_valid';
  elsif v_failure is null and v_now >= v_row.expires_at then v_failure := 'authorization_expired';
  elsif v_failure is null and v_now >= v_row.artifact_expires_at then v_failure := 'artifact_expired';
  end if;

  if v_failure is null and pg_catalog.jsonb_typeof(v_artifact_observation) <> 'object' then v_failure := 'artifact_mismatch';
  elsif v_failure is null and v_artifact_observation->>'status' = 'INDETERMINATE' then
    return query select v_row.request_id,v_row.status,v_row.action_manifest_sha256,v_row.artifact_id,v_row.run_id,v_row.run_attempt,
      v_row.consumed_at,null::text,'artifact_verification_indeterminate'::text,false;
    return;
  elsif v_failure is null and v_artifact_observation->>'status' = 'EXPIRED' then v_failure := 'artifact_expired';
  elsif v_failure is null and v_artifact_observation->>'status' = 'NOT_FOUND' then v_failure := 'artifact_mismatch';
  elsif v_failure is null and v_artifact_observation->>'status' <> 'MATCH' then v_failure := 'artifact_mismatch';
  end if;

  if v_failure is null then
    v_artifact := v_artifact_observation->'artifact';
    v_run := v_artifact_observation->'run';
    if pg_catalog.jsonb_typeof(v_artifact) <> 'object' or v_artifact->>'id' is distinct from v_row.artifact_id::text
      or v_artifact->>'name' is distinct from v_row.artifact_name or v_artifact->>'workflow_run_id' is distinct from v_row.artifact_run_id::text
      or v_artifact->>'created_at' is distinct from v_row.action_manifest->>'artifact_uploaded_at'
      or v_artifact->>'expires_at' is distinct from v_row.action_manifest->>'artifact_expires_at'
      or v_artifact->>'expired' is distinct from 'false' then v_failure := 'artifact_mismatch';
    elsif pg_catalog.jsonb_typeof(v_run) <> 'object' or v_run->>'id' is distinct from v_row.run_id::text then v_failure := 'run_mismatch';
    elsif v_run->>'run_attempt' is distinct from v_row.run_attempt::text then v_failure := 'run_attempt_mismatch';
    elsif v_run->>'head_sha' is distinct from v_row.source_commit_sha then v_failure := 'source_mismatch';
    end if;
  end if;

  perform pg_catalog.set_config('private.github_pages_publication_authorization_write_v0', 'enabled', true);
  perform pg_catalog.set_config('private.github_pages_publication_authorization_event_v0', 'enabled', true);
  if v_failure is not null then
    update private.github_pages_publication_authorizations_v0 as a set
      status=case when v_failure in ('authorization_expired','artifact_expired') then 'expired' else 'consumption_failed' end,
      terminal_failure_code=v_failure, terminal_failure_detail='authenticated first consumption attempt failed closed',
      consumption_oidc_evidence_sha256=oidc_evidence_sha256
    where a.request_id=target_request_id and a.status='authorized' returning * into strict v_row;
    insert into private.github_pages_publication_authorization_events_v0(request_id,event_type,from_status,to_status,actor_kind,actor_reference,evidence)
    values(target_request_id,case when v_row.status='expired' then 'expired' else 'consumption_failed' end,'authorized',v_row.status,
      'github_oidc_consumer','AETHERUS-MONOLITH',pg_catalog.jsonb_build_object('failure_code',v_failure));
    return query select v_row.request_id,v_row.status,v_row.action_manifest_sha256,v_row.artifact_id,v_row.run_id,v_row.run_attempt,
      v_row.consumed_at,null::text,v_failure,false;
    return;
  end if;

  v_receipt := private.github_pages_publication_sha256_v0(pg_catalog.concat_ws(E'\x1f',target_request_id::text,
    v_row.execution_identity_sha256,v_row.action_manifest_sha256,v_row.artifact_id::text,v_row.run_id::text,v_row.run_attempt::text,v_now::text));
  update private.github_pages_publication_authorizations_v0 as a set status='consumed',consumed_at=v_now,
    consumption_workflow_sha=v_row.workflow_sha,consumption_run_id=v_row.run_id,consumption_run_attempt=v_row.run_attempt,
    consumption_artifact_id=v_row.artifact_id,consumption_built_artifact_sha256=v_row.built_artifact_sha256,
    consumption_manifest_sha256=v_row.action_manifest_sha256,consumption_oidc_evidence_sha256=oidc_evidence_sha256
  where a.request_id=target_request_id and a.status='authorized' returning * into strict v_row;
  insert into private.github_pages_publication_authorization_events_v0(request_id,event_type,from_status,to_status,actor_kind,actor_reference,evidence)
  values(target_request_id,'consumed','authorized','consumed','github_oidc_consumer','AETHERUS-MONOLITH',
    pg_catalog.jsonb_build_object('consumption_receipt_sha256',v_receipt,'execution_identity_sha256',v_row.execution_identity_sha256));
  return query select v_row.request_id,v_row.status,v_row.action_manifest_sha256,v_row.artifact_id,v_row.run_id,v_row.run_attempt,
    v_row.consumed_at,v_receipt,null::text,true;
end;
$$;

alter function private.create_github_pages_publication_authorization_v0(jsonb,text,text) owner to postgres;
alter function private.resolve_github_pages_operator_cardinality_v0() owner to postgres;
alter function private.resolve_github_pages_operator_evidence_v0() owner to postgres;
alter function private.decide_github_pages_publication_authorization_v0(uuid,text,text) owner to postgres;
alter function private.consume_github_pages_publication_authorization_v0(uuid,jsonb,text) owner to postgres;
alter function private.enforce_github_pages_publication_authorization_write_v0() owner to postgres;

revoke all on function private.create_github_pages_publication_authorization_v0(jsonb,text,text) from public, anon, authenticated;
revoke all on function private.resolve_github_pages_operator_cardinality_v0() from public, anon, authenticated, service_role;
revoke all on function private.resolve_github_pages_operator_evidence_v0() from public, anon, authenticated;
revoke all on function private.decide_github_pages_publication_authorization_v0(uuid,text,text) from public, anon, authenticated;
revoke all on function private.consume_github_pages_publication_authorization_v0(uuid,jsonb,text) from public, anon, authenticated;

grant execute on function private.create_github_pages_publication_authorization_v0(jsonb,text,text) to service_role;
grant execute on function private.resolve_github_pages_operator_evidence_v0() to service_role;
grant execute on function private.decide_github_pages_publication_authorization_v0(uuid,text,text) to service_role;
grant execute on function private.consume_github_pages_publication_authorization_v0(uuid,jsonb,text) to service_role;
