#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const contractPath = "data/protected-operator-principal-substrate-contract.v0.json";
const migrationPath = "supabase/migrations/20260704_0001_protected_operator_principal_substrate.sql";
const workspaceMigrationPath = "supabase/migrations/20260619_0001_tenant_workspace_substrate.sql";

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function readText(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), "utf8");
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

function assertContains(text, needle, label) {
  assert(text.includes(needle), `${label}: missing "${needle}"`);
}

function assertMatches(text, pattern, label) {
  assert(pattern.test(text), `${label}: missing pattern ${pattern}`);
}

function assertJsonValue(value, expected, label) {
  assert(value === expected, `${label}: expected ${expected}, got ${value}`);
}

function assertArrayExact(value, expected, label) {
  assert(Array.isArray(value), `${label}: expected array`);
  assert(value.length === expected.length, `${label}: expected ${expected.length} entries`);
  for (const item of expected) assert(value.includes(item), `${label}: missing ${item}`);
}

function tableBody(sql) {
  const match = sql.match(/create\s+table\s+private\.workspace_operator_principals\s*\(([\s\S]*?)\n\);/i);
  if (!match) fail(`${migrationPath}: private.workspace_operator_principals table is missing`);
  return match[1];
}

function resolverBody(sql) {
  const match = sql.match(
    /create\s+or\s+replace\s+function\s+private\.resolve_current_operator_principal_core\s*\(\s*target_workspace_id\s+uuid\s*\)[\s\S]*?as\s+\$\$([\s\S]*?)\$\$;/i
  );
  if (!match) fail(`${migrationPath}: private resolver function is missing`);
  return match[1];
}

function lifecycleBody(sql) {
  const match = sql.match(
    /create\s+or\s+replace\s+function\s+private\.enforce_workspace_operator_principal_update\s*\(\s*\)[\s\S]*?as\s+\$\$([\s\S]*?)\$\$;/i
  );
  if (!match) fail(`${migrationPath}: lifecycle trigger function is missing`);
  return match[1];
}

function assertNoSensitiveMaterial(text, relativePath) {
  const forbiddenFragments = [
    "SUPABASE_" + "SERVICE" + "_" + "ROLE",
    "SERVICE" + "_" + "ROLE",
    "service" + "_" + "role",
    "JWT" + "_" + "SECRET",
    "jwt" + "_" + "secret",
    "post" + "gres://",
    "post" + "gresql://",
    "supabase" + ".co",
    "management" + "_" + "token",
    "access" + "_" + "token",
    "refresh" + "_" + "token"
  ];
  for (const fragment of forbiddenFragments) {
    assert(!text.includes(fragment), `${relativePath}: contains forbidden credential fragment`);
  }
  const credentialShapes = [
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
    /\bpostgres(?:ql)?:\/\/\S+/i,
    /\b(?:password|secret|token|credential)\s*=\s*['"][^'"]+['"]/i,
    /\b(?:password|secret|token|credential)\s*:\s*['"][^'"]+['"]/i
  ];
  for (const pattern of credentialShapes) {
    assert(!pattern.test(text), `${relativePath}: contains credential-shaped material`);
  }
}

function assertContract(contract) {
  assertJsonValue(contract.contract_id, "protected-operator-principal-substrate-contract.v0", "contract_id");
  assertJsonValue(contract.version, "0.1.0", "version");
  assertJsonValue(contract.status, "local_substrate", "status");
  assertJsonValue(contract.baseline_commit, "42025cf039d3bdc966a042da7169414db74cc593", "baseline");
  assertJsonValue(
    contract.owning_architecture.immediate_product_owner,
    "§1 / Facade protected workspace and authentication architecture",
    "immediate product owner"
  );
  assertJsonValue(contract.owning_architecture.implementation_substrate, "Supabase/PostgreSQL", "substrate");
  assertJsonValue(contract.owning_architecture.future_policy_consumer, "Palisade", "future policy consumer");
  assertJsonValue(contract.owning_architecture.future_transport_consumer, "Conduit", "future transport consumer");
  assertJsonValue(contract.owning_architecture.top_level_giant, "not_a_new_top_level_AETHERUS_Giant", "giant boundary");
  assertJsonValue(contract.trusted_owner, "postgres", "trusted owner");
  assertJsonValue(contract.table_path, "private.workspace_operator_principals", "table path");
  assertJsonValue(contract.resolver_path, "private.resolve_current_operator_principal_core(uuid)", "resolver path");
  assertJsonValue(contract.identity_source, "auth.uid() only; caller-supplied user identifiers are not trusted", "identity source");
  assertJsonValue(contract.principal_type, "human_operator", "principal type");
  assertJsonValue(contract.authority_class, "workspace_operator_principal", "authority class");
  assertArrayExact(contract.status_vocabulary, ["active", "suspended", "revoked"], "status vocabulary");
  assertArrayExact(contract.permitted_transitions, [
    "active->active",
    "active->suspended",
    "active->revoked",
    "suspended->suspended",
    "suspended->active",
    "suspended->revoked",
    "revoked->revoked"
  ], "permitted transitions");
  assertArrayExact(contract.prohibited_transitions, ["revoked->active", "revoked->suspended"], "prohibited transitions");
  assertJsonValue(contract.foreign_key_lifecycle.workspace_id, "references public.workspaces(id) on delete restrict", "workspace fk");
  assertJsonValue(contract.foreign_key_lifecycle.user_id, "references auth.users(id) on delete restrict", "user fk");
  assertJsonValue(contract.foreign_key_lifecycle.cascade_deletion_authorized, false, "cascade boundary");
  assertJsonValue(contract.uniqueness_and_reprovisioning_rules.expired_non_revoked_assignment_blocks_replacement, true, "expiry rule");
  assertJsonValue(contract.uniqueness_and_reprovisioning_rules.reprovisioning_requires_explicit_revocation, true, "reprovisioning rule");
  assertJsonValue(contract.uniqueness_and_reprovisioning_rules.revoked_row_provenance_overwrite_allowed, false, "revoked provenance rule");
  assertJsonValue(contract.provisioning_provenance.provisioning_method, "explicit_authorized_admin_sql", "provisioning method");
  assertJsonValue(contract.provisioning_provenance.provisioned_by_kind, "supabase_project_administrator", "provisioned kind");
  assertContains(contract.provisioning_provenance.provisioned_by_reference, "not an auth.users identity placeholder", "provisioning reference");
  assertContains(contract.static_validation_boundary, "static structure evidence", "static validation boundary");
  assertContains(contract.executable_validation_boundary, "existing repository-supported ephemeral harness", "executable validation boundary");
  assertContains(contract.live_application_boundary, "No live Supabase migration application", "live boundary");

  const requiredNonclaims = {
    "live migration application": "not performed",
    "Operator principal provisioned": "no",
    "live principal resolution": "not verified",
    "authorization issuer": "not implemented",
    "positive approval": "not implemented",
    "positive witness": "not implemented",
    "authorization challenge": "not implemented",
    "nonce or replay state": "not implemented",
    "atomic authorization consumption": "not implemented",
    "Palisade approval path": "unchanged",
    "Conduit authorization behavior": "unchanged",
    "public wrapper": "not implemented",
    "browser resolver": "not implemented",
    "production authorization": "not established"
  };
  for (const [key, expected] of Object.entries(requiredNonclaims)) {
    assertJsonValue(contract.nonclaims[key], expected, `nonclaim ${key}`);
  }
}

function assertWorkspaceDependency(workspaceSql) {
  assertMatches(workspaceSql, /create\s+table\s+public\.workspaces\s*\([\s\S]*?\bid\s+uuid\s+primary\s+key/i, `${workspaceMigrationPath} workspaces id`);
  assertMatches(workspaceSql, /create\s+table\s+public\.workspace_memberships\b/i, `${workspaceMigrationPath} memberships`);
  assertMatches(workspaceSql, /role\s+in\s+\('owner',\s*'admin',\s*'member',\s*'viewer'\)/i, `${workspaceMigrationPath} role vocabulary`);
  assertMatches(workspaceSql, /references\s+auth\.users\(id\)/i, `${workspaceMigrationPath} auth.users reference`);
  assertContains(workspaceSql, "auth.uid()", `${workspaceMigrationPath} auth.uid convention`);
}

function assertMigration(sql) {
  const body = tableBody(sql);
  const normalized = normalizeSql(sql);
  assertContains(sql, "create schema private authorization postgres", "private schema creation");
  assertContains(sql, "existing_private_schema_owner <> 'postgres'", "private schema owner assertion");
  assertContains(sql, "raise exception 'private schema owner must be postgres", "private schema conflict failure");
  for (const role of ["public", "anon", "authenticated"]) {
    assertContains(normalized, `revoke usage on schema private from ${role}`, `schema usage revoke ${role}`);
    assertContains(normalized, `revoke create on schema private from ${role}`, `schema create revoke ${role}`);
    assertContains(normalized, `revoke all privileges on table private.workspace_operator_principals from ${role}`, `table revoke ${role}`);
    assertContains(normalized, `revoke execute on function private.resolve_current_operator_principal_core(uuid) from ${role}`, `resolver revoke ${role}`);
    assertContains(normalized, `revoke execute on function private.enforce_workspace_operator_principal_update() from ${role}`, `lifecycle revoke ${role}`);
  }
  assertContains(normalized, "alter table private.workspace_operator_principals owner to postgres", "table owner");
  assertContains(normalized, "alter table private.workspace_operator_principals enable row level security", "RLS");
  assertContains(normalized, "alter function private.enforce_workspace_operator_principal_update() owner to postgres", "lifecycle owner");
  assertContains(normalized, "alter function private.resolve_current_operator_principal_core(uuid) owner to postgres", "resolver owner");

  for (const column of [
    "id uuid primary key default gen_random_uuid()",
    "workspace_id uuid not null",
    "user_id uuid not null",
    "principal_type text not null default 'human_operator'",
    "authority_class text not null default 'workspace_operator_principal'",
    "status text not null default 'active'",
    "authority_version text not null",
    "valid_from timestamptz not null default now()",
    "valid_until timestamptz",
    "provisioning_method text not null default 'explicit_authorized_admin_sql'",
    "provisioned_by_kind text not null default 'supabase_project_administrator'",
    "provisioned_by_reference text not null",
    "provisioning_authorization_reference text not null",
    "provisioning_execution_reference text not null",
    "created_at timestamptz not null default now()",
    "updated_at timestamptz not null default now()",
    "suspended_at timestamptz",
    "revoked_at timestamptz"
  ]) {
    assertContains(normalizeSql(body), column, `table column ${column}`);
  }

  assertMatches(body, /foreign\s+key\s+\(workspace_id\)[\s\S]*?references\s+public\.workspaces\(id\)[\s\S]*?on\s+delete\s+restrict/i, "workspace FK restrict");
  assertMatches(body, /foreign\s+key\s+\(user_id\)[\s\S]*?references\s+auth\.users\(id\)[\s\S]*?on\s+delete\s+restrict/i, "user FK restrict");
  assertContains(body, "status in ('active', 'suspended', 'revoked')", "status constraint");
  assertContains(body, "principal_type = 'human_operator'", "principal type constraint");
  assertContains(body, "authority_class = 'workspace_operator_principal'", "authority class constraint");
  assertContains(body, "provisioning_method = 'explicit_authorized_admin_sql'", "provisioning method constraint");
  assertContains(body, "provisioned_by_kind = 'supabase_project_administrator'", "provisioned kind constraint");
  assertContains(body, "length(btrim(authority_version)) > 0", "authority version nonempty");
  assertContains(body, "length(btrim(provisioned_by_reference)) > 0", "provisioned by reference nonempty");
  assertContains(body, "length(btrim(provisioning_authorization_reference)) > 0", "authorization reference nonempty");
  assertContains(body, "length(btrim(provisioning_execution_reference)) > 0", "execution reference nonempty");
  assertContains(body, "status = 'active'", "active timestamp state");
  assertContains(body, "status = 'suspended'", "suspended timestamp state");
  assertContains(body, "status = 'revoked'", "revoked timestamp state");
  assertContains(body, "valid_until is null or valid_until > valid_from", "validity interval");
  assertContains(body, "suspended_at is null or suspended_at >= valid_from", "suspended timestamp lower bound");
  assertContains(body, "revoked_at is null or revoked_at >= valid_from", "revoked timestamp lower bound");

  assertMatches(sql, /create\s+unique\s+index\s+workspace_operator_principals_non_revoked_assignment_uidx\s+on\s+private\.workspace_operator_principals\s+\(workspace_id,\s*user_id\)\s+where\s+status\s+in\s+\('active',\s*'suspended'\)/i, "non-revoked partial unique index");

  const lifecycle = lifecycleBody(sql);
  assertContains(lifecycle, "old.id is distinct from new.id", "immutable id");
  assertContains(lifecycle, "old.workspace_id is distinct from new.workspace_id", "immutable workspace");
  assertContains(lifecycle, "old.user_id is distinct from new.user_id", "immutable user");
  assertContains(lifecycle, "old.provisioning_authorization_reference is distinct from new.provisioning_authorization_reference", "immutable authorization reference");
  assertContains(lifecycle, "old.provisioning_execution_reference is distinct from new.provisioning_execution_reference", "immutable execution reference");
  assertContains(lifecycle, "old.status = 'revoked' and new.status in ('active', 'suspended')", "terminal revocation");
  assertContains(lifecycle, "old.status = 'active' and new.status = 'suspended'", "active to suspended");
  assertContains(lifecycle, "old.status = 'suspended' and new.status = 'active'", "suspended to active");
  assertContains(lifecycle, "old.status in ('active', 'suspended') and new.status = 'revoked'", "revocation transition");
  assertContains(lifecycle, "old.status = 'revoked' and new.status = 'revoked'", "revoked same-status guard");
  assertContains(lifecycle, "new.revoked_at is distinct from old.revoked_at", "revoked timestamp preservation");
  assertMatches(sql, /create\s+trigger\s+enforce_workspace_operator_principal_update_trigger[\s\S]*?before\s+update\s+on\s+private\.workspace_operator_principals[\s\S]*?execute\s+function\s+private\.enforce_workspace_operator_principal_update\(\)/i, "trigger attachment");

  const resolver = resolverBody(sql);
  assertMatches(sql, /resolve_current_operator_principal_core\s*\(\s*target_workspace_id\s+uuid\s*\)/i, "exact resolver argument");
  assertContains(normalized, "security definer", "resolver security definer");
  assertContains(normalized, "set search_path = ''", "empty search path");
  assertContains(resolver, "auth.uid() is not null", "resolver auth.uid presence");
  assertContains(resolver, "assignment.user_id = auth.uid()", "resolver user identity binding");
  assertContains(resolver, "assignment.workspace_id = target_workspace_id", "resolver workspace binding");
  assertContains(resolver, "assignment.status = 'active'", "resolver active predicate");
  assertContains(resolver, "assignment.valid_from <= now()", "resolver valid_from predicate");
  assertContains(resolver, "assignment.valid_until is null or now() < assignment.valid_until", "resolver valid_until predicate");
  for (const outputColumn of [
    "operator_principal_id uuid",
    "authenticated_user_id uuid",
    "workspace_id uuid",
    "principal_type text",
    "authority_class text",
    "authority_version text",
    "status text",
    "resolution_status text"
  ]) {
    assertContains(normalized, outputColumn, `resolver output ${outputColumn}`);
  }
  for (const forbidden of [
    /\binsert\b/i,
    /\bupdate\b/i,
    /\bdelete\b/i,
    /\bupsert\b/i,
    /\bmerge\b/i,
    /\btruncate\b/i,
    /\bcreate\s+table\b/i,
    /\balter\s+table\b/i,
    /\bdrop\b/i
  ]) {
    assert(!forbidden.test(resolver), `resolver contains mutation or DDL token ${forbidden}`);
  }

  assert(!/create\s+(?:or\s+replace\s+)?function\s+public\.resolve_current_operator_principal_core/i.test(sql), "public resolver wrapper must not exist");
  assert(!/create\s+table\s+public\.workspace_operator_principals/i.test(sql), "public authority table must not exist");
  assert(!/create\s+policy[\s\S]*?on\s+private\.workspace_operator_principals/i.test(sql), "permissive private table RLS policy must not exist");
  assert(!/grant\s+.+\s+on\s+(?:schema|table|function)\s+private/i.test(sql), "private grants must not be added");
  assert(!/insert\s+into\s+private\.workspace_operator_principals/i.test(sql), "positive authority rows must not be inserted");

  for (const prohibited of [
    "owner-to-Operator",
    "admin-to-Operator",
    "workspace creation",
    "membership creation",
    "github",
    "email mapping",
    "environment-variable",
    "repository-owner",
    "nonce",
    "replay",
    "witness",
    "signature",
    "approval state",
    "authorization status",
    "authorization challenge",
    "authorization consumption",
    "palisade decision state"
  ]) {
    assert(!normalizeSql(sql).includes(prohibited.toLowerCase()), `${migrationPath}: prohibited authority inference or authorization state token ${prohibited}`);
  }
}

const [contractText, migrationSql, workspaceSql] = await Promise.all([
  readText(contractPath),
  readText(migrationPath),
  readText(workspaceMigrationPath)
]);

assertNoSensitiveMaterial(contractText, contractPath);
assertNoSensitiveMaterial(migrationSql, migrationPath);
const contract = JSON.parse(contractText);
assertContract(contract);
assertWorkspaceDependency(workspaceSql);
assertMigration(migrationSql);

console.log("protected Operator principal substrate static validation passed");
console.log(`contract: ${contractPath}`);
console.log(`migration: ${migrationPath}`);
console.log(`workspace dependency: ${workspaceMigrationPath}`);
console.log("classification: static structure evidence only; no runtime database behavior inferred");
