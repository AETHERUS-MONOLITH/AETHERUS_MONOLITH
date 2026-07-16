-- Runtime correction: target the named request-key uniqueness constraint explicitly.
-- The SQL signature and external contract remain unchanged.

alter table private.github_pages_publication_authorizations_v0
  add constraint github_pages_publication_authorizations_v0_request_key_unique
  unique using index github_pages_publication_authorizations_v0_request_key_uidx;

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
  ) on conflict on constraint github_pages_publication_authorizations_v0_request_key_unique do nothing;
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

alter function private.create_github_pages_publication_authorization_v0(jsonb,text,text) owner to postgres;
revoke execute on function private.create_github_pages_publication_authorization_v0(jsonb,text,text) from public, anon, authenticated;
grant execute on function private.create_github_pages_publication_authorization_v0(jsonb,text,text) to service_role;
