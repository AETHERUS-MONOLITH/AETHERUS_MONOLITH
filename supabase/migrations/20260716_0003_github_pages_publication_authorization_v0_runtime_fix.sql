-- Runtime correction: LEAST is SQL syntax and must not be schema-qualified.
-- The signatures, grants, fixed fields, and state transitions are unchanged.

create or replace function private.create_github_pages_publication_authorization_v0(manifest jsonb, manifest_sha256 text, request_key_sha256 text)
returns table (request_id uuid, status text, action_manifest_sha256 text, request_expires_at timestamptz, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := transaction_timestamp();
  v_request_id uuid := extensions.gen_random_uuid();
  v_row private.github_pages_publication_authorizations_v0%rowtype;
begin
  perform private.validate_github_pages_publication_manifest_v0(manifest, manifest_sha256, request_key_sha256);
  if (manifest->>'artifact_expires_at')::timestamptz <= v_now then raise exception 'artifact expired'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(request_key_sha256, 0));
  perform pg_catalog.set_config('private.github_pages_publication_authorization_write_v0', 'enabled', true);
  insert into private.github_pages_publication_authorizations_v0 (
    request_id, action_identifier, workspace_id, repository, repository_id, repository_ref, workflow_path, workflow_name, workflow_sha,
    run_id, run_attempt, requester_actor, requester_actor_id, requester_oidc_evidence_sha256, source_commit_sha, source_tree_sha,
    runtime_config_evidence_sha256, built_artifact_sha256, operator_resolution_evidence_sha256, artifact_id, artifact_name, artifact_run_id,
    artifact_run_attempt, artifact_uploaded_at, artifact_expires_at, upload_action_repository, upload_action_commit_sha,
    deploy_action_repository, deploy_action_commit_sha, environment_name, canonical_public_target, permitted_effect,
    maximum_artifact_uploads, maximum_deployments, authorization_contract_version, action_manifest, action_manifest_sha256,
    request_key_sha256, request_expires_at
  ) values (
    v_request_id, manifest->>'action_identifier', (manifest->>'workspace_id')::uuid, manifest->>'repository', (manifest->>'repository_id')::bigint,
    manifest->>'ref', manifest->>'workflow_path', manifest->>'workflow_name', manifest->>'workflow_sha', (manifest->>'run_id')::bigint,
    (manifest->>'run_attempt')::integer, manifest->>'requester_actor', (manifest->>'requester_actor_id')::bigint,
    manifest->>'requester_oidc_evidence_sha256', manifest->>'source_commit_sha', manifest->>'source_tree_sha',
    manifest->>'runtime_config_evidence_sha256', manifest->>'built_artifact_sha256', manifest->>'operator_resolution_evidence_sha256',
    (manifest->>'artifact_id')::bigint, manifest->>'artifact_name', (manifest->>'artifact_run_id')::bigint,
    (manifest->>'artifact_run_attempt')::integer, (manifest->>'artifact_uploaded_at')::timestamptz, (manifest->>'artifact_expires_at')::timestamptz,
    manifest->>'upload_action_repository', manifest->>'upload_action_commit_sha', manifest->>'deploy_action_repository',
    manifest->>'deploy_action_commit_sha', manifest->>'environment_name', manifest->>'canonical_public_target', manifest->>'permitted_effect',
    (manifest->>'maximum_artifact_uploads')::integer, (manifest->>'maximum_deployments')::integer, manifest->>'authorization_contract_version',
    manifest, manifest_sha256, request_key_sha256, least(v_now + interval '900 seconds', (manifest->>'artifact_expires_at')::timestamptz)
  ) on conflict (request_key_sha256) do nothing;
  select a.* into strict v_row from private.github_pages_publication_authorizations_v0 a where a.request_key_sha256 = create_github_pages_publication_authorization_v0.request_key_sha256 for update;
  if v_row.action_manifest_sha256 <> manifest_sha256 or v_row.action_manifest <> manifest then raise exception 'request key collision'; end if;
  if v_row.request_id = v_request_id then
    perform pg_catalog.set_config('private.github_pages_publication_authorization_event_v0', 'enabled', true);
    insert into private.github_pages_publication_authorization_events_v0(request_id,event_type,from_status,to_status,actor_kind,actor_reference,evidence)
    values (v_row.request_id,'request_created',null,'pending','github_oidc_requester','AETHERUS-MONOLITH',pg_catalog.jsonb_build_object('action_manifest_sha256',manifest_sha256));
  end if;
  return query select v_row.request_id, v_row.status, v_row.action_manifest_sha256, v_row.request_expires_at, v_row.created_at;
end;
$$;

create or replace function private.decide_github_pages_publication_authorization_v0(target_request_id uuid, decision text, reason text)
returns table (request_id uuid, status text, action_manifest_sha256 text, issued_at timestamptz, not_before timestamptz, expires_at timestamptz, decision_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := transaction_timestamp();
  v_row private.github_pages_publication_authorizations_v0%rowtype;
  v_operator record;
begin
  if decision not in ('authorize','reject') then raise exception 'decision must be authorize or reject'; end if;
  if auth.uid() is distinct from '4702d528-f7a7-4a04-a991-3176bec69f52'::uuid then raise exception 'fixed Operator authentication required'; end if;
  select * into strict v_operator from private.resolve_current_operator_principal_core('9abed891-7950-4937-a2aa-4b957d8a4bd1'::uuid);
  if v_operator.operator_principal_id <> 'e438b03c-c708-4cba-94e4-e106ee9958c4'::uuid
    or v_operator.authenticated_user_id <> '4702d528-f7a7-4a04-a991-3176bec69f52'::uuid
    or v_operator.principal_type <> 'human_operator'
    or v_operator.authority_class <> 'workspace_operator_principal'
    or v_operator.authority_version <> 'Operator Principal Application and Provisioning 0.1 — Phase 2B'
  then raise exception 'fixed Operator authority mismatch'; end if;
  select a.* into strict v_row from private.github_pages_publication_authorizations_v0 a where a.request_id = target_request_id for update;
  if v_row.status <> 'pending' then raise exception 'authorization request is not pending'; end if;
  perform pg_catalog.set_config('private.github_pages_publication_authorization_write_v0', 'enabled', true);
  perform pg_catalog.set_config('private.github_pages_publication_authorization_event_v0', 'enabled', true);
  if v_now >= v_row.request_expires_at or v_now >= v_row.artifact_expires_at then
    update private.github_pages_publication_authorizations_v0 a set status='expired', terminal_failure_code='request_or_artifact_expired', terminal_failure_detail='request expired before decision' where a.request_id=target_request_id returning * into v_row;
    insert into private.github_pages_publication_authorization_events_v0(request_id,event_type,from_status,to_status,actor_kind,actor_reference,evidence)
    values(target_request_id,'expired','pending','expired','fixed_operator',v_operator.operator_principal_id::text,'{}'::jsonb);
  elsif decision = 'authorize' then
    update private.github_pages_publication_authorizations_v0 a set
      status='authorized', issued_at=v_now, not_before=v_now, expires_at=least(v_now + interval '300 seconds', a.artifact_expires_at),
      authorizer_operator_principal_id=v_operator.operator_principal_id, authorizer_user_id=v_operator.authenticated_user_id,
      authorizer_principal_type=v_operator.principal_type, authorizer_authority_class=v_operator.authority_class,
      authorizer_authority_version=v_operator.authority_version, decision_at=v_now, decision_reason=reason
    where a.request_id=target_request_id and a.status='pending' returning * into strict v_row;
    insert into private.github_pages_publication_authorization_events_v0(request_id,event_type,from_status,to_status,actor_kind,actor_reference,evidence)
    values(target_request_id,'authorized','pending','authorized','fixed_operator',v_operator.operator_principal_id::text,pg_catalog.jsonb_build_object('expires_at',v_row.expires_at));
  else
    update private.github_pages_publication_authorizations_v0 a set
      status='rejected', authorizer_operator_principal_id=v_operator.operator_principal_id, authorizer_user_id=v_operator.authenticated_user_id,
      authorizer_principal_type=v_operator.principal_type, authorizer_authority_class=v_operator.authority_class,
      authorizer_authority_version=v_operator.authority_version, decision_at=v_now, decision_reason=reason,
      terminal_failure_code='operator_rejected', terminal_failure_detail=pg_catalog.coalesce(reason,'rejected')
    where a.request_id=target_request_id and a.status='pending' returning * into strict v_row;
    insert into private.github_pages_publication_authorization_events_v0(request_id,event_type,from_status,to_status,actor_kind,actor_reference,evidence)
    values(target_request_id,'rejected','pending','rejected','fixed_operator',v_operator.operator_principal_id::text,'{}'::jsonb);
  end if;
  return query select v_row.request_id,v_row.status,v_row.action_manifest_sha256,v_row.issued_at,v_row.not_before,v_row.expires_at,v_row.decision_at;
end;
$$;

alter function private.create_github_pages_publication_authorization_v0(jsonb,text,text) owner to postgres;
alter function private.decide_github_pages_publication_authorization_v0(uuid,text,text) owner to postgres;
revoke execute on function private.create_github_pages_publication_authorization_v0(jsonb,text,text) from public, anon, authenticated;
revoke execute on function private.decide_github_pages_publication_authorization_v0(uuid,text,text) from public, anon, authenticated;
grant execute on function private.create_github_pages_publication_authorization_v0(jsonb,text,text) to service_role;
grant execute on function private.decide_github_pages_publication_authorization_v0(uuid,text,text) to service_role;
