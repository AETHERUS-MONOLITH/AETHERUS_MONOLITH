\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('4702d528-f7a7-4a04-a991-3176bec69f52', 'fixed-operator@example.invalid'),
  ('5702d528-f7a7-4a04-a991-3176bec69f52', 'non-operator@example.invalid'),
  ('6702d528-f7a7-4a04-a991-3176bec69f52', 'alternate-operator@example.invalid');

insert into public.workspaces (id, slug, name, owner_user_id)
values ('9abed891-7950-4937-a2aa-4b957d8a4bd1', 'phase4-corrective-fixture', 'Phase 4 Corrective Fixture', '4702d528-f7a7-4a04-a991-3176bec69f52');

insert into private.workspace_operator_principals (
  id, workspace_id, user_id, principal_type, authority_class, status, authority_version,
  valid_from, provisioning_method, provisioned_by_kind, provisioned_by_reference,
  provisioning_authorization_reference, provisioning_execution_reference
) values (
  'e438b03c-c708-4cba-94e4-e106ee9958c4',
  '9abed891-7950-4937-a2aa-4b957d8a4bd1',
  '4702d528-f7a7-4a04-a991-3176bec69f52',
  'human_operator',
  'workspace_operator_principal',
  'active',
  'Operator Principal Application and Provisioning 0.1 — Phase 2B',
  pg_catalog.transaction_timestamp() - interval '1 day',
  'explicit_authorized_admin_sql',
  'supabase_project_administrator',
  'phase4-disposable-fixture',
  'phase4-corrective-directive',
  'phase4-disposable-database'
);
