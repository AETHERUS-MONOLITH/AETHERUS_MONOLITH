-- Protected Operator Principal Substrate 0.1: private authority assignment substrate.
--
-- This migration is authored repository material only.
-- It has not been applied to the external Supabase project.
-- It has not been executed by this pass.
-- It has not been verified against live Supabase.
-- It creates no Operator-principal rows and performs no provisioning.
-- It does not implement action authorization behavior, Palisade behavior,
-- Conduit behavior, public RPC access, or a browser-accessible resolver.

do $$
declare
  existing_private_schema_owner text;
begin
  select pg_get_userbyid(nspowner)
    into existing_private_schema_owner
  from pg_namespace
  where nspname = 'private';

  if existing_private_schema_owner is null then
    execute 'create schema private authorization postgres';
  elsif existing_private_schema_owner <> 'postgres' then
    raise exception 'private schema owner must be postgres, found %', existing_private_schema_owner;
  end if;
end
$$;

revoke usage on schema private from public;
revoke create on schema private from public;
revoke usage on schema private from anon;
revoke create on schema private from anon;
revoke usage on schema private from authenticated;
revoke create on schema private from authenticated;

create table private.workspace_operator_principals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null,

  principal_type text not null default 'human_operator',
  authority_class text not null default 'workspace_operator_principal',
  status text not null default 'active',
  authority_version text not null,

  valid_from timestamptz not null default now(),
  valid_until timestamptz,

  provisioning_method text not null default 'explicit_authorized_admin_sql',
  provisioned_by_kind text not null default 'supabase_project_administrator',
  provisioned_by_reference text not null,
  provisioning_authorization_reference text not null,
  provisioning_execution_reference text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  suspended_at timestamptz,
  revoked_at timestamptz,

  constraint workspace_operator_principals_workspace_id_fkey
    foreign key (workspace_id)
    references public.workspaces(id)
    on delete restrict,
  constraint workspace_operator_principals_user_id_fkey
    foreign key (user_id)
    references auth.users(id)
    on delete restrict,
  constraint workspace_operator_principals_fixed_classification_check
    check (
      principal_type = 'human_operator'
      and authority_class = 'workspace_operator_principal'
      and provisioning_method = 'explicit_authorized_admin_sql'
      and provisioned_by_kind = 'supabase_project_administrator'
    ),
  constraint workspace_operator_principals_status_check
    check (status in ('active', 'suspended', 'revoked')),
  constraint workspace_operator_principals_nonempty_provenance_check
    check (
      length(btrim(authority_version)) > 0
      and length(btrim(provisioned_by_reference)) > 0
      and length(btrim(provisioning_authorization_reference)) > 0
      and length(btrim(provisioning_execution_reference)) > 0
    ),
  constraint workspace_operator_principals_timestamp_consistency_check
    check (
      (
        status = 'active'
        and suspended_at is null
        and revoked_at is null
      )
      or (
        status = 'suspended'
        and suspended_at is not null
        and revoked_at is null
      )
      or (
        status = 'revoked'
        and revoked_at is not null
      )
    ),
  constraint workspace_operator_principals_validity_interval_check
    check (valid_until is null or valid_until > valid_from),
  constraint workspace_operator_principals_event_timestamps_check
    check (
      (suspended_at is null or suspended_at >= valid_from)
      and (revoked_at is null or revoked_at >= valid_from)
    )
);

alter table private.workspace_operator_principals owner to postgres;

alter table private.workspace_operator_principals enable row level security;

revoke all privileges on table private.workspace_operator_principals from public;
revoke all privileges on table private.workspace_operator_principals from anon;
revoke all privileges on table private.workspace_operator_principals from authenticated;

create unique index workspace_operator_principals_non_revoked_assignment_uidx
  on private.workspace_operator_principals (workspace_id, user_id)
  where status in ('active', 'suspended');

create or replace function private.enforce_workspace_operator_principal_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.id is distinct from new.id
    or old.workspace_id is distinct from new.workspace_id
    or old.user_id is distinct from new.user_id
    or old.principal_type is distinct from new.principal_type
    or old.authority_class is distinct from new.authority_class
    or old.authority_version is distinct from new.authority_version
    or old.valid_from is distinct from new.valid_from
    or old.provisioning_method is distinct from new.provisioning_method
    or old.provisioned_by_kind is distinct from new.provisioned_by_kind
    or old.provisioned_by_reference is distinct from new.provisioned_by_reference
    or old.provisioning_authorization_reference is distinct from new.provisioning_authorization_reference
    or old.provisioning_execution_reference is distinct from new.provisioning_execution_reference
    or old.created_at is distinct from new.created_at then
    raise exception 'workspace Operator principal assignment identity and provisioning provenance are immutable';
  end if;

  if old.status = 'revoked' and new.status in ('active', 'suspended') then
    raise exception 'revoked workspace Operator principal assignments are terminal';
  end if;

  if old.status = 'active' and new.status = 'suspended' then
    if new.suspended_at is null or new.revoked_at is not null then
      raise exception 'active to suspended requires suspended_at and no revoked_at';
    end if;
  elsif old.status = 'suspended' and new.status = 'active' then
    if new.suspended_at is not null or new.revoked_at is not null then
      raise exception 'suspended to active must clear suspended_at and leave revoked_at null';
    end if;
  elsif old.status in ('active', 'suspended') and new.status = 'revoked' then
    if new.revoked_at is null then
      raise exception 'revocation requires revoked_at';
    end if;
  elsif old.status = 'revoked' and new.status = 'revoked' then
    if new.revoked_at is null or new.revoked_at is distinct from old.revoked_at then
      raise exception 'revoked workspace Operator principal assignments must retain revoked_at';
    end if;
  end if;

  return new;
end;
$$;

alter function private.enforce_workspace_operator_principal_update() owner to postgres;

revoke execute on function private.enforce_workspace_operator_principal_update() from public;
revoke execute on function private.enforce_workspace_operator_principal_update() from anon;
revoke execute on function private.enforce_workspace_operator_principal_update() from authenticated;

create trigger enforce_workspace_operator_principal_update_trigger
  before update on private.workspace_operator_principals
  for each row
  execute function private.enforce_workspace_operator_principal_update();

create or replace function private.resolve_current_operator_principal_core(
  target_workspace_id uuid
)
returns table (
  operator_principal_id uuid,
  authenticated_user_id uuid,
  workspace_id uuid,
  principal_type text,
  authority_class text,
  authority_version text,
  status text,
  resolution_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    assignment.id as operator_principal_id,
    assignment.user_id as authenticated_user_id,
    assignment.workspace_id,
    assignment.principal_type,
    assignment.authority_class,
    assignment.authority_version,
    assignment.status,
    'resolved'::text as resolution_status
  from private.workspace_operator_principals as assignment
  where auth.uid() is not null
    and assignment.user_id = auth.uid()
    and assignment.workspace_id = target_workspace_id
    and assignment.principal_type = 'human_operator'
    and assignment.authority_class = 'workspace_operator_principal'
    and assignment.status = 'active'
    and assignment.valid_from <= now()
    and (assignment.valid_until is null or now() < assignment.valid_until)
  limit 1;
$$;

alter function private.resolve_current_operator_principal_core(uuid) owner to postgres;

revoke execute on function private.resolve_current_operator_principal_core(uuid) from public;
revoke execute on function private.resolve_current_operator_principal_core(uuid) from anon;
revoke execute on function private.resolve_current_operator_principal_core(uuid) from authenticated;
