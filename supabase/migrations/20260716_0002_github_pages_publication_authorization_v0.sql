-- Action-specific replay-safe authorization for github_pages_outward_publication@0.1.
-- This migration intentionally exposes no generic authorization primitive.

create table private.github_pages_publication_authorizations_v0 (
  request_id uuid primary key,
  action_identifier text not null,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  repository text not null,
  repository_id bigint not null,
  repository_ref text not null,
  workflow_path text not null,
  workflow_name text not null,
  workflow_sha text not null,
  run_id bigint not null,
  run_attempt integer not null,
  requester_actor text not null,
  requester_actor_id bigint not null,
  requester_oidc_evidence_sha256 text not null,
  source_commit_sha text not null,
  source_tree_sha text not null,
  runtime_config_evidence_sha256 text not null,
  built_artifact_sha256 text not null,
  operator_resolution_evidence_sha256 text not null,
  artifact_id bigint not null,
  artifact_name text not null,
  artifact_run_id bigint not null,
  artifact_run_attempt integer not null,
  artifact_uploaded_at timestamptz not null,
  artifact_expires_at timestamptz not null,
  upload_action_repository text not null,
  upload_action_commit_sha text not null,
  deploy_action_repository text not null,
  deploy_action_commit_sha text not null,
  environment_name text not null,
  canonical_public_target text not null,
  permitted_effect text not null,
  maximum_artifact_uploads integer not null,
  maximum_deployments integer not null,
  authorization_contract_version text not null,
  action_manifest jsonb not null,
  action_manifest_sha256 text not null,
  request_key_sha256 text not null,
  status text not null default 'pending',
  request_expires_at timestamptz not null,
  issued_at timestamptz,
  not_before timestamptz,
  expires_at timestamptz,
  authorizer_operator_principal_id uuid references private.workspace_operator_principals(id) on delete restrict,
  authorizer_user_id uuid references auth.users(id) on delete restrict,
  authorizer_principal_type text,
  authorizer_authority_class text,
  authorizer_authority_version text,
  decision_at timestamptz,
  decision_reason text,
  consumed_at timestamptz,
  consumption_workflow_sha text,
  consumption_run_id bigint,
  consumption_run_attempt integer,
  consumption_artifact_id bigint,
  consumption_built_artifact_sha256 text,
  consumption_manifest_sha256 text,
  consumption_oidc_evidence_sha256 text,
  terminal_failure_code text,
  terminal_failure_detail text,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint github_pages_publication_authorizations_v0_action_ck check (action_identifier = 'github_pages_outward_publication@0.1'),
  constraint github_pages_publication_authorizations_v0_workspace_ck check (workspace_id = '9abed891-7950-4937-a2aa-4b957d8a4bd1'::uuid),
  constraint github_pages_publication_authorizations_v0_repository_ck check (repository = 'AETHERUS-MONOLITH/AETHERUS_MONOLITH' and repository_id = 1167751543),
  constraint github_pages_publication_authorizations_v0_ref_ck check (repository_ref = 'refs/heads/main'),
  constraint github_pages_publication_authorizations_v0_workflow_ck check (workflow_path = '.github/workflows/pages-runtime-config.yml' and workflow_name = 'Deploy Pages with runtime config'),
  constraint github_pages_publication_authorizations_v0_requester_ck check (requester_actor = 'AETHERUS-MONOLITH' and requester_actor_id = 264210171),
  constraint github_pages_publication_authorizations_v0_artifact_ck check (artifact_name = 'github-pages-governable-v0-1'),
  constraint github_pages_publication_authorizations_v0_actions_ck check (
    upload_action_repository = 'actions/upload-pages-artifact'
    and upload_action_commit_sha = '56afc609e74202658d3ffba0e8f6dda462b719fa'
    and deploy_action_repository = 'actions/deploy-pages'
    and deploy_action_commit_sha = 'd6db90164ac5ed86f2b6aed7e0febac5b3c0c03e'
  ),
  constraint github_pages_publication_authorizations_v0_effect_ck check (
    environment_name = 'github-pages'
    and canonical_public_target = 'https://camilocarlone.com/'
    and maximum_artifact_uploads = 1
    and maximum_deployments = 1
  ),
  constraint github_pages_publication_authorizations_v0_contract_ck check (authorization_contract_version = 'github-pages-publication-authorization-v0'),
  constraint github_pages_publication_authorizations_v0_status_ck check (status in ('pending', 'authorized', 'rejected', 'consumed', 'consumption_failed', 'expired')),
  constraint github_pages_publication_authorizations_v0_attempt_ck check (run_attempt = 1 and artifact_run_attempt = 1 and artifact_run_id = run_id),
  constraint github_pages_publication_authorizations_v0_sha_ck check (
    workflow_sha ~ '^[0-9a-f]{40}$'
    and source_commit_sha ~ '^[0-9a-f]{40}$'
    and source_tree_sha ~ '^[0-9a-f]{40}$'
    and requester_oidc_evidence_sha256 ~ '^[0-9a-f]{64}$'
    and runtime_config_evidence_sha256 ~ '^[0-9a-f]{64}$'
    and built_artifact_sha256 ~ '^[0-9a-f]{64}$'
    and operator_resolution_evidence_sha256 ~ '^[0-9a-f]{64}$'
    and action_manifest_sha256 ~ '^[0-9a-f]{64}$'
    and request_key_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint github_pages_publication_authorizations_v0_time_ck check (
    artifact_uploaded_at < artifact_expires_at
    and created_at <= request_expires_at
    and (issued_at is null or issued_at >= created_at)
    and (not_before is null or not_before = issued_at)
    and (expires_at is null or (issued_at is not null and expires_at > issued_at and expires_at <= artifact_expires_at and expires_at <= issued_at + interval '300 seconds'))
  ),
  constraint github_pages_publication_authorizations_v0_authorizer_ck check (
    (status = 'pending' and authorizer_operator_principal_id is null and decision_at is null and issued_at is null and expires_at is null)
    or
    (status in ('authorized', 'consumed', 'consumption_failed')
      and authorizer_operator_principal_id = 'e438b03c-c708-4cba-94e4-e106ee9958c4'::uuid
      and authorizer_user_id = '4702d528-f7a7-4a04-a991-3176bec69f52'::uuid
      and authorizer_principal_type = 'human_operator'
      and authorizer_authority_class = 'workspace_operator_principal'
      and authorizer_authority_version = 'Operator Principal Application and Provisioning 0.1 — Phase 2B'
      and decision_at is not null and issued_at is not null and not_before is not null and expires_at is not null)
    or
    (status in ('rejected', 'expired'))
  ),
  constraint github_pages_publication_authorizations_v0_consumption_ck check (
    (status = 'consumed'
      and consumed_at is not null
      and consumption_workflow_sha = workflow_sha
      and consumption_run_id = run_id
      and consumption_run_attempt = run_attempt
      and consumption_artifact_id = artifact_id
      and consumption_built_artifact_sha256 = built_artifact_sha256
      and consumption_manifest_sha256 = action_manifest_sha256
      and consumption_oidc_evidence_sha256 ~ '^[0-9a-f]{64}$')
    or
    (status <> 'consumed')
  )
);

create unique index github_pages_publication_authorizations_v0_request_key_uidx
  on private.github_pages_publication_authorizations_v0 (request_key_sha256);
create unique index github_pages_publication_authorizations_v0_replay_tuple_uidx
  on private.github_pages_publication_authorizations_v0 (workflow_sha, run_id, run_attempt, artifact_id, built_artifact_sha256, action_manifest_sha256);
create index github_pages_publication_authorizations_v0_status_expiry_idx
  on private.github_pages_publication_authorizations_v0 (status, expires_at, request_expires_at);
create index github_pages_publication_authorizations_v0_operator_idx
  on private.github_pages_publication_authorizations_v0 (authorizer_operator_principal_id);

create table private.github_pages_publication_authorization_events_v0 (
  event_id bigint generated always as identity primary key,
  request_id uuid not null references private.github_pages_publication_authorizations_v0(request_id) on delete restrict,
  event_type text not null,
  from_status text,
  to_status text not null,
  actor_kind text not null,
  actor_reference text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default transaction_timestamp(),
  constraint github_pages_publication_authorization_events_v0_status_ck check (to_status in ('pending', 'authorized', 'rejected', 'consumed', 'consumption_failed', 'expired')),
  constraint github_pages_publication_authorization_events_v0_type_ck check (event_type in ('request_created', 'authorized', 'rejected', 'consumed', 'consumption_failed', 'expired', 'replay_rejected'))
);
create index github_pages_publication_authorization_events_v0_request_idx
  on private.github_pages_publication_authorization_events_v0 (request_id, event_id);

alter table private.github_pages_publication_authorizations_v0 enable row level security;
alter table private.github_pages_publication_authorizations_v0 force row level security;
alter table private.github_pages_publication_authorization_events_v0 enable row level security;
alter table private.github_pages_publication_authorization_events_v0 force row level security;
alter table private.github_pages_publication_authorizations_v0 owner to postgres;
alter table private.github_pages_publication_authorization_events_v0 owner to postgres;

revoke all privileges on table private.github_pages_publication_authorizations_v0 from public, anon, authenticated, service_role;
revoke all privileges on table private.github_pages_publication_authorization_events_v0 from public, anon, authenticated, service_role;
revoke all privileges on sequence private.github_pages_publication_authorization_events_v0_event_id_seq from public, anon, authenticated, service_role;

create or replace function private.github_pages_publication_sha256_v0(input text)
returns text
language sql
immutable
strict
security definer
set search_path = ''
as $$
  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(input, 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function private.github_pages_publication_request_key_v0(manifest jsonb)
returns text
language sql
immutable
strict
security definer
set search_path = ''
as $$
  select private.github_pages_publication_sha256_v0(pg_catalog.concat_ws(
    E'\x1f',
    manifest->>'action_identifier', manifest->>'workspace_id', manifest->>'repository', manifest->>'repository_id',
    manifest->>'ref', manifest->>'workflow_sha', manifest->>'run_id', manifest->>'run_attempt',
    manifest->>'artifact_id', manifest->>'built_artifact_sha256', manifest->>'action_manifest_sha256',
    manifest->>'canonical_public_target'
  ));
$$;

create or replace function private.validate_github_pages_publication_manifest_v0(manifest jsonb, expected_manifest_sha256 text, expected_request_key_sha256 text)
returns void
language plpgsql
immutable
strict
security definer
set search_path = ''
as $$
declare
  required_keys_input constant text[] := array[
    'schema_version','action_identifier','workspace_id','repository','repository_id','ref','workflow_path','workflow_name','workflow_sha',
    'run_id','run_attempt','requester_actor','requester_actor_id','requester_oidc_evidence_sha256','source_commit_sha','source_tree_sha',
    'runtime_config_evidence_sha256','built_artifact_sha256','operator_resolution_evidence_sha256','artifact_id','artifact_name','artifact_run_id',
    'artifact_run_attempt','artifact_uploaded_at','artifact_expires_at','upload_action_repository','upload_action_commit_sha','deploy_action_repository',
    'deploy_action_commit_sha','environment_name','canonical_public_target','permitted_effect','maximum_artifact_uploads','maximum_deployments',
    'authorization_contract_version','action_manifest_sha256'
  ];
  actual_keys text[];
  expected_keys text[];
begin
  if pg_catalog.jsonb_typeof(manifest) <> 'object' then raise exception 'manifest must be an object'; end if;
  select pg_catalog.array_agg(item order by item) into actual_keys from pg_catalog.jsonb_object_keys(manifest) as keys(item);
  select pg_catalog.array_agg(item order by item) into expected_keys from pg_catalog.unnest(required_keys_input) as keys(item);
  if actual_keys is distinct from expected_keys then raise exception 'manifest fields mismatch'; end if;
  if expected_manifest_sha256 !~ '^[0-9a-f]{64}$' or manifest->>'action_manifest_sha256' <> expected_manifest_sha256 then raise exception 'manifest digest mismatch'; end if;
  if expected_request_key_sha256 !~ '^[0-9a-f]{64}$' or private.github_pages_publication_request_key_v0(manifest) <> expected_request_key_sha256 then raise exception 'request key mismatch'; end if;
  if manifest->>'schema_version' <> '0.1'
    or manifest->>'action_identifier' <> 'github_pages_outward_publication@0.1'
    or manifest->>'workspace_id' <> '9abed891-7950-4937-a2aa-4b957d8a4bd1'
    or manifest->>'repository' <> 'AETHERUS-MONOLITH/AETHERUS_MONOLITH'
    or manifest->>'repository_id' <> '1167751543'
    or manifest->>'ref' <> 'refs/heads/main'
    or manifest->>'workflow_path' <> '.github/workflows/pages-runtime-config.yml'
    or manifest->>'workflow_name' <> 'Deploy Pages with runtime config'
    or manifest->>'run_attempt' <> '1'
    or manifest->>'requester_actor' <> 'AETHERUS-MONOLITH'
    or manifest->>'requester_actor_id' <> '264210171'
    or manifest->>'artifact_name' <> 'github-pages-governable-v0-1'
    or manifest->>'artifact_run_id' <> manifest->>'run_id'
    or manifest->>'artifact_run_attempt' <> '1'
    or manifest->>'upload_action_repository' <> 'actions/upload-pages-artifact'
    or manifest->>'upload_action_commit_sha' <> '56afc609e74202658d3ffba0e8f6dda462b719fa'
    or manifest->>'deploy_action_repository' <> 'actions/deploy-pages'
    or manifest->>'deploy_action_commit_sha' <> 'd6db90164ac5ed86f2b6aed7e0febac5b3c0c03e'
    or manifest->>'environment_name' <> 'github-pages'
    or manifest->>'canonical_public_target' <> 'https://camilocarlone.com/'
    or manifest->>'maximum_artifact_uploads' <> '1'
    or manifest->>'maximum_deployments' <> '1'
    or manifest->>'authorization_contract_version' <> 'github-pages-publication-authorization-v0'
  then raise exception 'manifest fixed field mismatch'; end if;
  if manifest->>'workflow_sha' !~ '^[0-9a-f]{40}$'
    or manifest->>'source_commit_sha' !~ '^[0-9a-f]{40}$'
    or manifest->>'source_tree_sha' !~ '^[0-9a-f]{40}$'
    or manifest->>'requester_oidc_evidence_sha256' !~ '^[0-9a-f]{64}$'
    or manifest->>'runtime_config_evidence_sha256' !~ '^[0-9a-f]{64}$'
    or manifest->>'built_artifact_sha256' !~ '^[0-9a-f]{64}$'
    or manifest->>'operator_resolution_evidence_sha256' !~ '^[0-9a-f]{64}$'
  then raise exception 'manifest digest field invalid'; end if;
end;
$$;

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
  new.updated_at := transaction_timestamp();
  return new;
end;
$$;

create trigger enforce_github_pages_publication_authorization_write_v0_trigger
before insert or update or delete on private.github_pages_publication_authorizations_v0
for each row execute function private.enforce_github_pages_publication_authorization_write_v0();

create or replace function private.enforce_github_pages_publication_authorization_event_v0()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' or pg_catalog.current_setting('private.github_pages_publication_authorization_event_v0', true) <> 'enabled' then
    raise exception 'authorization events are append-only and function-owned';
  end if;
  return new;
end;
$$;

create trigger enforce_github_pages_publication_authorization_event_v0_trigger
before insert or update or delete on private.github_pages_publication_authorization_events_v0
for each row execute function private.enforce_github_pages_publication_authorization_event_v0();

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
    manifest, manifest_sha256, request_key_sha256, pg_catalog.least(v_now + interval '900 seconds', (manifest->>'artifact_expires_at')::timestamptz)
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
  v_status text;
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
      status='authorized', issued_at=v_now, not_before=v_now, expires_at=pg_catalog.least(v_now + interval '300 seconds', a.artifact_expires_at),
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

create or replace function private.resolve_github_pages_publication_authorization_v0(target_request_id uuid, manifest_sha256 text)
returns table (request_id uuid, status text, action_manifest_sha256 text, request_expires_at timestamptz, issued_at timestamptz, not_before timestamptz, expires_at timestamptz, decision_at timestamptz, terminal_failure_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := transaction_timestamp();
  v_row private.github_pages_publication_authorizations_v0%rowtype;
begin
  select a.* into strict v_row from private.github_pages_publication_authorizations_v0 a where a.request_id=target_request_id and a.action_manifest_sha256=manifest_sha256 for update;
  if (v_row.status='pending' and (v_now >= v_row.request_expires_at or v_now >= v_row.artifact_expires_at))
    or (v_row.status='authorized' and (v_now < v_row.not_before or v_now >= v_row.expires_at or v_now >= v_row.artifact_expires_at)) then
    perform pg_catalog.set_config('private.github_pages_publication_authorization_write_v0', 'enabled', true);
    perform pg_catalog.set_config('private.github_pages_publication_authorization_event_v0', 'enabled', true);
    update private.github_pages_publication_authorizations_v0 a set status='expired',terminal_failure_code='authorization_expired',terminal_failure_detail='database clock passed applicable expiry' where a.request_id=target_request_id returning * into v_row;
    insert into private.github_pages_publication_authorization_events_v0(request_id,event_type,from_status,to_status,actor_kind,actor_reference,evidence)
    values(target_request_id,'expired',case when v_row.issued_at is null then 'pending' else 'authorized' end,'expired','database_clock','transaction_timestamp','{}'::jsonb);
  end if;
  return query select v_row.request_id,v_row.status,v_row.action_manifest_sha256,v_row.request_expires_at,v_row.issued_at,v_row.not_before,v_row.expires_at,v_row.decision_at,v_row.terminal_failure_code;
end;
$$;

create or replace function private.consume_github_pages_publication_authorization_v0(target_request_id uuid, manifest jsonb, manifest_sha256 text, request_key_sha256 text, oidc_evidence_sha256 text)
returns table (request_id uuid, status text, action_manifest_sha256 text, artifact_id bigint, run_id bigint, run_attempt integer, consumed_at timestamptz, consumption_receipt_sha256 text, terminal_failure_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := transaction_timestamp();
  v_row private.github_pages_publication_authorizations_v0%rowtype;
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
  if v_now < v_row.not_before or v_now >= v_row.expires_at or v_now >= v_row.artifact_expires_at then v_failure := 'authorization_expired';
  elsif v_row.action_manifest_sha256 <> manifest_sha256 or v_row.request_key_sha256 <> request_key_sha256 or v_row.action_manifest <> manifest then v_failure := 'manifest_mismatch';
  elsif v_row.workflow_sha <> manifest->>'workflow_sha' or v_row.run_id <> (manifest->>'run_id')::bigint or v_row.run_attempt <> (manifest->>'run_attempt')::integer then v_failure := 'run_tuple_mismatch';
  elsif v_row.artifact_id <> (manifest->>'artifact_id')::bigint or v_row.built_artifact_sha256 <> manifest->>'built_artifact_sha256' then v_failure := 'artifact_tuple_mismatch';
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

alter function private.github_pages_publication_sha256_v0(text) owner to postgres;
alter function private.github_pages_publication_request_key_v0(jsonb) owner to postgres;
alter function private.validate_github_pages_publication_manifest_v0(jsonb,text,text) owner to postgres;
alter function private.enforce_github_pages_publication_authorization_write_v0() owner to postgres;
alter function private.enforce_github_pages_publication_authorization_event_v0() owner to postgres;
alter function private.create_github_pages_publication_authorization_v0(jsonb,text,text) owner to postgres;
alter function private.decide_github_pages_publication_authorization_v0(uuid,text,text) owner to postgres;
alter function private.resolve_github_pages_publication_authorization_v0(uuid,text) owner to postgres;
alter function private.consume_github_pages_publication_authorization_v0(uuid,jsonb,text,text,text) owner to postgres;

revoke execute on function private.github_pages_publication_sha256_v0(text) from public, anon, authenticated, service_role;
revoke execute on function private.github_pages_publication_request_key_v0(jsonb) from public, anon, authenticated, service_role;
revoke execute on function private.validate_github_pages_publication_manifest_v0(jsonb,text,text) from public, anon, authenticated, service_role;
revoke execute on function private.enforce_github_pages_publication_authorization_write_v0() from public, anon, authenticated, service_role;
revoke execute on function private.enforce_github_pages_publication_authorization_event_v0() from public, anon, authenticated, service_role;
revoke execute on function private.create_github_pages_publication_authorization_v0(jsonb,text,text) from public, anon, authenticated;
revoke execute on function private.decide_github_pages_publication_authorization_v0(uuid,text,text) from public, anon, authenticated;
revoke execute on function private.resolve_github_pages_publication_authorization_v0(uuid,text) from public, anon, authenticated;
revoke execute on function private.consume_github_pages_publication_authorization_v0(uuid,jsonb,text,text,text) from public, anon, authenticated;
grant execute on function private.create_github_pages_publication_authorization_v0(jsonb,text,text) to service_role;
grant execute on function private.decide_github_pages_publication_authorization_v0(uuid,text,text) to service_role;
grant execute on function private.resolve_github_pages_publication_authorization_v0(uuid,text) to service_role;
grant execute on function private.consume_github_pages_publication_authorization_v0(uuid,jsonb,text,text,text) to service_role;
