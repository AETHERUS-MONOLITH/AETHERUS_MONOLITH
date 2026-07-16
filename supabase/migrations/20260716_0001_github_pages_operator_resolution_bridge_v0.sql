-- Fixed server-only bridge for github_pages_outward_publication@0.1.
-- No assignment, authority, lifecycle, or application data is mutated.

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
  fixed_workspace_id constant uuid := '9abed891-7950-4937-a2aa-4b957d8a4bd1'::uuid;
  fixed_operator_user_id constant uuid := '4702d528-f7a7-4a04-a991-3176bec69f52'::uuid;
  resolved_count integer;
  resolved_operator_principal_id uuid;
  resolved_authenticated_user_id uuid;
  resolved_workspace_id uuid;
  resolved_principal_type text;
  resolved_authority_class text;
  resolved_authority_version text;
  resolved_status text;
  resolved_resolution_status text;
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', fixed_operator_user_id::text, true);
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);

  select
    count(*)::integer,
    (pg_catalog.array_agg(candidate.operator_principal_id))[1],
    (pg_catalog.array_agg(candidate.authenticated_user_id))[1],
    (pg_catalog.array_agg(candidate.workspace_id))[1],
    (pg_catalog.array_agg(candidate.principal_type))[1],
    (pg_catalog.array_agg(candidate.authority_class))[1],
    (pg_catalog.array_agg(candidate.authority_version))[1],
    (pg_catalog.array_agg(candidate.status))[1],
    (pg_catalog.array_agg(candidate.resolution_status))[1]
    into
      resolved_count,
      resolved_operator_principal_id,
      resolved_authenticated_user_id,
      resolved_workspace_id,
      resolved_principal_type,
      resolved_authority_class,
      resolved_authority_version,
      resolved_status,
      resolved_resolution_status
  from private.resolve_current_operator_principal_core(fixed_workspace_id) as candidate;

  if resolved_count <> 1 then
    raise exception 'fixed GitHub Pages Operator resolution requires exactly one result';
  end if;

  if resolved_authenticated_user_id is distinct from fixed_operator_user_id
    or resolved_workspace_id is distinct from fixed_workspace_id
    or resolved_principal_type is distinct from 'human_operator'
    or resolved_authority_class is distinct from 'workspace_operator_principal'
    or resolved_status is distinct from 'active'
    or resolved_resolution_status is distinct from 'resolved'
    or resolved_operator_principal_id is null
    or resolved_authority_version is null then
    raise exception 'fixed GitHub Pages Operator resolution mismatch';
  end if;

  return query
  select
    resolved_operator_principal_id,
    resolved_workspace_id,
    resolved_principal_type,
    resolved_authority_class,
    resolved_authority_version,
    resolved_status,
    resolved_resolution_status,
    pg_catalog.clock_timestamp();
end;
$$;

alter function private.resolve_github_pages_operator_evidence_v0() owner to postgres;

revoke all on function private.resolve_github_pages_operator_evidence_v0() from public;
revoke all on function private.resolve_github_pages_operator_evidence_v0() from anon;
revoke all on function private.resolve_github_pages_operator_evidence_v0() from authenticated;
grant usage on schema private to service_role;
grant execute on function private.resolve_github_pages_operator_evidence_v0() to service_role;
