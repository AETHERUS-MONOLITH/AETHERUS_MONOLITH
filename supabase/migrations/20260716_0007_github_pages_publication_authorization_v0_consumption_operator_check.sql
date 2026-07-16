-- Re-resolve the fixed active Operator immediately before atomic consumption.
create or replace function private.consume_github_pages_publication_authorization_v0(target_request_id uuid, manifest jsonb, manifest_sha256 text, request_key_sha256 text, oidc_evidence_sha256 text)
returns table (request_id uuid, status text, action_manifest_sha256 text, artifact_id bigint, run_id bigint, run_attempt integer, consumed_at timestamptz, consumption_receipt_sha256 text, terminal_failure_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := transaction_timestamp();
  v_row private.github_pages_publication_authorizations_v0%rowtype;
  v_operator record;
  v_failure text;
  v_receipt text;
begin
  perform private.validate_github_pages_publication_manifest_v0(manifest,manifest_sha256,request_key_sha256);
  if oidc_evidence_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'OIDC evidence digest invalid'; end if;
  select a.* into strict v_row from private.github_pages_publication_authorizations_v0 a where a.request_id=target_request_id for update;
  if v_row.status <> 'authorized' then
    return query select v_row.request_id,v_row.status,v_row.action_manifest_sha256,v_row.artifact_id,v_row.run_id,v_row.run_attempt,v_row.consumed_at,null::text,'replay_or_non_authorized_state'::text;
    return;
  end if;
  begin
    select * into strict v_operator from private.resolve_github_pages_operator_evidence_v0();
    if v_operator.operator_principal_id <> 'e438b03c-c708-4cba-94e4-e106ee9958c4'::uuid
      or v_operator.workspace_id <> '9abed891-7950-4937-a2aa-4b957d8a4bd1'::uuid
      or v_operator.principal_type <> 'human_operator'
      or v_operator.authority_class <> 'workspace_operator_principal'
      or v_operator.authority_version <> 'Operator Principal Application and Provisioning 0.1 — Phase 2B'
      or v_operator.status <> 'active'
      or v_operator.resolution_status <> 'resolved'
    then v_failure := 'operator_assignment_invalid'; end if;
  exception when others then
    v_failure := 'operator_assignment_unresolved';
  end;
  if v_failure is null and (v_now < v_row.not_before or v_now >= v_row.expires_at or v_now >= v_row.artifact_expires_at) then v_failure := 'authorization_expired';
  elsif v_failure is null and (v_row.action_manifest_sha256 <> manifest_sha256 or v_row.request_key_sha256 <> request_key_sha256 or v_row.action_manifest <> manifest) then v_failure := 'manifest_mismatch';
  elsif v_failure is null and (v_row.workflow_sha <> manifest->>'workflow_sha' or v_row.run_id <> (manifest->>'run_id')::bigint or v_row.run_attempt <> (manifest->>'run_attempt')::integer) then v_failure := 'run_tuple_mismatch';
  elsif v_failure is null and (v_row.artifact_id <> (manifest->>'artifact_id')::bigint or v_row.built_artifact_sha256 <> manifest->>'built_artifact_sha256') then v_failure := 'artifact_tuple_mismatch';
  end if;
  perform pg_catalog.set_config('private.github_pages_publication_authorization_write_v0', 'enabled', true);
  perform pg_catalog.set_config('private.github_pages_publication_authorization_event_v0', 'enabled', true);
  if v_failure is not null then
    update private.github_pages_publication_authorizations_v0 a set status=case when v_failure='authorization_expired' then 'expired' else 'consumption_failed' end,
      terminal_failure_code=v_failure,terminal_failure_detail='first consumption attempt failed closed',consumption_oidc_evidence_sha256=oidc_evidence_sha256
    where a.request_id=target_request_id and a.status='authorized' returning * into strict v_row;
    insert into private.github_pages_publication_authorization_events_v0(request_id,event_type,from_status,to_status,actor_kind,actor_reference,evidence)
    values(target_request_id,case when v_row.status='expired' then 'expired' else 'consumption_failed' end,'authorized',v_row.status,'github_oidc_consumer','AETHERUS-MONOLITH',pg_catalog.jsonb_build_object('failure_code',v_failure));
    return query select v_row.request_id,v_row.status,v_row.action_manifest_sha256,v_row.artifact_id,v_row.run_id,v_row.run_attempt,v_row.consumed_at,null::text,v_failure;
    return;
  end if;
  v_receipt := private.github_pages_publication_sha256_v0(pg_catalog.concat_ws(E'\x1f',target_request_id::text,manifest_sha256,manifest->>'artifact_id',manifest->>'run_id',manifest->>'run_attempt',v_now::text));
  update private.github_pages_publication_authorizations_v0 a set status='consumed',consumed_at=v_now,
    consumption_workflow_sha=manifest->>'workflow_sha',consumption_run_id=(manifest->>'run_id')::bigint,
    consumption_run_attempt=(manifest->>'run_attempt')::integer,consumption_artifact_id=(manifest->>'artifact_id')::bigint,
    consumption_built_artifact_sha256=manifest->>'built_artifact_sha256',consumption_manifest_sha256=manifest_sha256,
    consumption_oidc_evidence_sha256=oidc_evidence_sha256
  where a.request_id=target_request_id and a.status='authorized' returning * into strict v_row;
  insert into private.github_pages_publication_authorization_events_v0(request_id,event_type,from_status,to_status,actor_kind,actor_reference,evidence)
  values(target_request_id,'consumed','authorized','consumed','github_oidc_consumer','AETHERUS-MONOLITH',pg_catalog.jsonb_build_object('consumption_receipt_sha256',v_receipt));
  return query select v_row.request_id,v_row.status,v_row.action_manifest_sha256,v_row.artifact_id,v_row.run_id,v_row.run_attempt,v_row.consumed_at,v_receipt,null::text;
end;
$$;

alter function private.consume_github_pages_publication_authorization_v0(uuid,jsonb,text,text,text) owner to postgres;
revoke execute on function private.consume_github_pages_publication_authorization_v0(uuid,jsonb,text,text,text) from public, anon, authenticated;
grant execute on function private.consume_github_pages_publication_authorization_v0(uuid,jsonb,text,text,text) to service_role;
