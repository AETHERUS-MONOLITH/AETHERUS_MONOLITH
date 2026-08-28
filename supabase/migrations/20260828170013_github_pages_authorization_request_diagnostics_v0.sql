create table private.github_pages_authorization_request_diagnostics_v0 (
  diagnostic_id uuid primary key,
  occurred_at timestamptz not null,
  persisted_at timestamptz not null default pg_catalog.transaction_timestamp(),
  function_name text not null check (function_name = 'github-pages-authorization-request-v0'),
  function_version text not null check (function_version ~ '^(unknown|[0-9]{1,20})$'),
  request_operation text not null check (request_operation in ('create','status','unknown')),
  repository_id text check (repository_id is null or repository_id ~ '^[0-9]{1,32}$'),
  workflow_sha text check (workflow_sha is null or workflow_sha ~ '^[0-9a-f]{40}$'),
  run_id text check (run_id is null or run_id ~ '^[0-9]{1,32}$'),
  run_attempt text check (run_attempt is null or run_attempt ~ '^[0-9]{1,10}$'),
  manifest_sha256 text check (manifest_sha256 is null or manifest_sha256 ~ '^[0-9a-f]{64}$'),
  artifact_id text check (artifact_id is null or artifact_id ~ '^[0-9]{1,32}$'),
  token_sha256 text check (token_sha256 is null or token_sha256 ~ '^[0-9a-f]{64}$'),
  rejection_stage text not null check (rejection_stage in (
    'route','request_size','bearer_syntax','body_parse','body_shape','manifest_validation','oidc_validation',
    'requester_evidence','artifact_verification','database_credential','database_connection','database_request','database_cardinality'
  )),
  bounded_reason_code text not null check (bounded_reason_code in (
    'route_mismatch','request_too_large','invalid_bearer_syntax','body_parse_failed','body_shape_invalid','create_field_set_mismatch',
    'manifest_validation_failed','oidc_signature_failed','oidc_issuer_mismatch','oidc_audience_mismatch','oidc_temporal_invalid',
    'oidc_repository_mismatch','oidc_repository_id_mismatch','oidc_owner_mismatch','oidc_actor_mismatch','oidc_actor_id_mismatch',
    'oidc_triggering_actor_mismatch','oidc_workflow_mismatch','oidc_workflow_sha_mismatch','oidc_ref_mismatch','oidc_event_mismatch',
    'oidc_run_mismatch','oidc_run_attempt_mismatch','oidc_source_commit_mismatch','requester_oidc_evidence_mismatch',
    'artifact_authentication_failed','artifact_not_found','artifact_mismatch','artifact_run_mismatch','artifact_attempt_mismatch','artifact_expired',
    'database_credential_unavailable','database_connection_failed','database_request_rejected','database_result_cardinality_mismatch',
    'internal_indeterminate_failure'
  )),
  exception_class text not null check (exception_class ~ '^[A-Za-z0-9_.-]{1,128}$'),
  http_response_class text not null check (http_response_class ~ '^[1-5]xx$')
);

comment on table private.github_pages_authorization_request_diagnostics_v0 is
  'Append-only, non-secret bounded rejection evidence for the GitHub Pages authorization-request Edge boundary.';

alter table private.github_pages_authorization_request_diagnostics_v0 enable row level security;
alter table private.github_pages_authorization_request_diagnostics_v0 force row level security;
alter table private.github_pages_authorization_request_diagnostics_v0 owner to postgres;

revoke all on table private.github_pages_authorization_request_diagnostics_v0 from public, anon, authenticated, service_role;
grant insert on table private.github_pages_authorization_request_diagnostics_v0 to service_role;

create function private.reject_github_pages_auth_request_diagnostic_mutation_v0()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'authorization request diagnostics are append-only';
end;
$$;

alter function private.reject_github_pages_auth_request_diagnostic_mutation_v0() owner to postgres;
revoke all on function private.reject_github_pages_auth_request_diagnostic_mutation_v0() from public, anon, authenticated, service_role;

create trigger github_pages_authorization_request_diagnostics_v0_append_only
before update or delete on private.github_pages_authorization_request_diagnostics_v0
for each row execute function private.reject_github_pages_auth_request_diagnostic_mutation_v0();
