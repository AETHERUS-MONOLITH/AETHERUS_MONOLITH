#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const migrationPath = "supabase/migrations/20260619_0001_tenant_workspace_substrate.sql";
const validatorPath = "scripts/validate-direct-ui-membrane-tenant-workspace-migration-substrate.mjs";

function fail(message) {
  throw new Error(message);
}

async function readText(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), "utf8");
}

function assertContains(text, needle, label) {
  if (!text.includes(needle)) fail(`${label}: missing "${needle}"`);
}

function assertMatches(text, pattern, label) {
  if (!pattern.test(text)) fail(`${label}: missing pattern ${pattern}`);
}

function tableBody(sql, tableName) {
  const pattern = new RegExp(
    `create\\s+table\\s+public\\.${tableName}\\s*\\(([\\s\\S]*?)\\n\\);`,
    "i"
  );
  const match = sql.match(pattern);
  if (!match) fail(`public.${tableName}: create table statement is missing`);
  return match[1];
}

function assertTableColumns(sql, tableName, requiredColumns) {
  const body = tableBody(sql, tableName);
  for (const column of requiredColumns) {
    assertMatches(body, new RegExp(`\\b${column}\\b`, "i"), `public.${tableName}`);
  }
}

function assertTenantScoped(sql, tableName) {
  const body = tableBody(sql, tableName);
  assertMatches(
    body,
    /\bworkspace_id\s+uuid\s+not\s+null\s+references\s+public\.workspaces\(id\)/i,
    `public.${tableName} tenant scope`
  );
}

function assertAuthUserReference(sql, tableName, columnName) {
  const body = tableBody(sql, tableName);
  assertMatches(
    body,
    new RegExp(`\\b${columnName}\\b[\\s\\S]*?references\\s+auth\\.users\\(id\\)`, "i"),
    `public.${tableName}.${columnName}`
  );
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
    "supabase_" + "management",
    "management" + "_" + "token",
    "anon" + "_" + "key=",
    "anon" + "-" + "key=",
    "fake" + "_" + "secret",
    "fake" + "-" + "secret"
  ];

  for (const fragment of forbiddenFragments) {
    if (text.includes(fragment)) fail(`${relativePath}: contains forbidden credential fragment`);
  }

  const credentialShapes = [
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
    /\bpostgres(?:ql)?:\/\/\S+/i,
    /\b(?:password|secret|token|credential)\s*=\s*['"][^'"]+['"]/i,
    /\b(?:password|secret|token|credential)\s*:\s*['"][^'"]+['"]/i,
    /\b(?:anon[_-]?key)\s*=\s*['"]?[A-Za-z0-9._-]{12,}/i
  ];

  for (const pattern of credentialShapes) {
    if (pattern.test(text)) fail(`${relativePath}: contains credential-shaped material`);
  }
}

function assertValidatorDoesNotInvokeInfrastructure(selfText) {
  const importLines = selfText
    .split(/\r?\n/)
    .filter((line) => /^\s*import\b/.test(line));
  const forbiddenImports = [
    "node:" + "child_process",
    "node:" + "net",
    "node:" + "tls",
    "node:" + "dns",
    "node:" + "http",
    "node:" + "https"
  ];

  for (const moduleName of forbiddenImports) {
    if (importLines.some((line) => line.includes(moduleName))) {
      fail(`${validatorPath}: imports infrastructure-capable module ${moduleName}`);
    }
  }

  const forbiddenCalls = [
    "ex" + "ec(",
    "exec" + "File(",
    "sp" + "awn(",
    "spawn" + "Sync(",
    "req" + "uest(",
    "con" + "nect(",
    "lis" + "ten(",
    "create" + "Connection(",
    "create" + "Server(",
    "fet" + "ch(",
    "XML" + "HttpRequest",
    "Deno." + "serve",
    "create" + "Client(",
    "supabase db " + "push",
    "supabase db " + "reset",
    "supabase migration " + "up",
    "p" + "sql"
  ];

  for (const call of forbiddenCalls) {
    if (selfText.includes(call)) {
      fail(`${validatorPath}: contains prohibited execution or network token "${call}"`);
    }
  }
}

function assertHeader(sql) {
  const headerEnd = sql.indexOf("create table public.workspaces");
  if (headerEnd === -1) fail(`${migrationPath}: create table public.workspaces is missing`);
  const header = sql.slice(0, headerEnd);
  const requiredHeaderStatements = [
    "This migration is authored repository material only.",
    "It has not been applied to the external Supabase project.",
    "It has not been executed by this pass.",
    "It has not been verified against live Supabase.",
    "It does not prove backend, database, application-data persistence, RLS",
    "implementation, tenant isolation, customer workspace, customer data handling,",
    "audit ledger implementation, or production SaaS capability.",
    "RLS policy SQL in this file is authored but not implemented until a later",
    "authorized application and verification pass."
  ];

  for (const statement of requiredHeaderStatements) {
    assertContains(header, statement, `${migrationPath} header`);
  }
}

function assertRequiredTablesAndColumns(sql) {
  const requiredTables = [
    "workspaces",
    "workspace_memberships",
    "workspace_state_records",
    "workspace_events"
  ];

  for (const table of requiredTables) {
    assertMatches(sql, new RegExp(`create\\s+table\\s+public\\.${table}\\b`, "i"), "required tables");
  }

  assertTableColumns(sql, "workspaces", [
    "id",
    "slug",
    "name",
    "owner_user_id",
    "created_at",
    "updated_at",
    "archived_at"
  ]);

  assertTableColumns(sql, "workspace_memberships", [
    "workspace_id",
    "user_id",
    "role",
    "status",
    "invited_by_user_id",
    "created_at",
    "updated_at"
  ]);

  assertTableColumns(sql, "workspace_state_records", [
    "id",
    "workspace_id",
    "record_type",
    "record_key",
    "state_payload",
    "created_by_user_id",
    "updated_by_user_id",
    "created_at",
    "updated_at"
  ]);

  assertTableColumns(sql, "workspace_events", [
    "id",
    "workspace_id",
    "actor_user_id",
    "event_type",
    "target_table",
    "target_id",
    "event_payload",
    "created_at"
  ]);
}

function assertTenantAndIdentityShape(sql) {
  for (const table of ["workspace_memberships", "workspace_state_records", "workspace_events"]) {
    assertTenantScoped(sql, table);
  }

  assertAuthUserReference(sql, "workspaces", "owner_user_id");
  assertAuthUserReference(sql, "workspace_memberships", "user_id");
  assertAuthUserReference(sql, "workspace_memberships", "invited_by_user_id");
  assertAuthUserReference(sql, "workspace_state_records", "created_by_user_id");
  assertAuthUserReference(sql, "workspace_state_records", "updated_by_user_id");
  assertAuthUserReference(sql, "workspace_events", "actor_user_id");
}

function assertIndexesAndConstraints(sql) {
  const requiredIndexHints = [
    "workspaces_owner_user_id_idx",
    "workspace_memberships_user_id_idx",
    "workspace_memberships_workspace_role_status_idx",
    "workspace_state_records_lookup_idx",
    "workspace_events_ordering_idx"
  ];

  for (const indexName of requiredIndexHints) {
    assertContains(sql, indexName, `${migrationPath} indexes`);
  }

  assertMatches(
    sql,
    /role\s+in\s+\('owner',\s*'admin',\s*'member',\s*'viewer'\)/i,
    "workspace_memberships role constraint"
  );
  assertMatches(
    sql,
    /status\s+in\s+\('active',\s*'invited',\s*'suspended'\)/i,
    "workspace_memberships status constraint"
  );
  assertMatches(
    sql,
    /unique\s+\(workspace_id,\s*record_type,\s*record_key\)/i,
    "workspace_state_records unique lookup"
  );
}

function assertAuthoredRlsText(sql) {
  const rlsTables = [
    "workspaces",
    "workspace_memberships",
    "workspace_state_records",
    "workspace_events"
  ];

  for (const table of rlsTables) {
    assertMatches(
      sql,
      new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i"),
      `public.${table} authored RLS`
    );
  }

  assertContains(sql, "auth.uid()", `${migrationPath} RLS identity intent`);
  assertContains(sql, "public.workspace_memberships", `${migrationPath} RLS tenant membership intent`);
  assertMatches(sql, /create\s+policy\b/i, `${migrationPath} policy SQL`);
  assertHeader(sql);
}

function assertNoPublicCopyRequirement(sql) {
  const forbiddenCopyTargets = [
    "index.html",
    "auth-login.html",
    "auth-boundary.html",
    "membrane.html",
    "workspace.html",
    "README.md",
    "data/docs.json"
  ];

  for (const target of forbiddenCopyTargets) {
    if (sql.includes(target)) fail(`${migrationPath}: must not require public copy changes`);
  }

  const copyRequirementPattern = /public\s+copy\s+(?:file|change|update)\s+(?:is\s+)?required/i;
  if (copyRequirementPattern.test(sql)) {
    fail(`${migrationPath}: must not require public copy changes`);
  }
}

const migrationText = await readText(migrationPath);
const validatorText = await readText(validatorPath);

assertHeader(migrationText);
assertRequiredTablesAndColumns(migrationText);
assertTenantAndIdentityShape(migrationText);
assertIndexesAndConstraints(migrationText);
assertAuthoredRlsText(migrationText);
assertNoSensitiveMaterial(migrationText, migrationPath);
assertNoSensitiveMaterial(validatorText, validatorPath);
assertValidatorDoesNotInvokeInfrastructure(validatorText);
assertNoPublicCopyRequirement(migrationText);

console.log("Tenant workspace migration substrate validation passed.");
