create or replace function public.guard_bounded_artifact_joint_identity()
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
    if old.artifact_identity is not null and old.artifact_identity is distinct from new.artifact_identity then
      raise exception 'bounded artifact joint artifact identity is immutable';
    end if;
  end if;
  return new;
end;
$$;
