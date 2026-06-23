import fs from "node:fs";

const recordPath = "data/direct-ui-membrane-protected-workspace-persistence.v0.json";
const migrationPath = "supabase/migrations/20260619_0001_tenant_workspace_substrate.sql";
const protectedShellPath = "protected-shell.html";
const workspaceScriptPath = "js/protected-workspace.js";

const failures = [];

function fail(message) {
  failures.push(message);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertIncludes(text, phrase, label) {
  assert(text.includes(phrase), `${label}: missing ${phrase}`);
}

function assertNotIncludes(text, phrase, label) {
  assert(!text.includes(phrase), `${label}: forbidden ${phrase}`);
}

function assertMatches(text, pattern, label) {
  assert(pattern.test(text), `${label}: missing pattern ${pattern}`);
}

function assertNotMatches(text, pattern, label) {
  assert(!pattern.test(text), `${label}: forbidden pattern ${pattern}`);
}

for (const filePath of [recordPath, migrationPath, protectedShellPath, workspaceScriptPath]) {
  if (!fs.existsSync(filePath)) fail(`${filePath} is missing`);
}

const record = fs.existsSync(recordPath) ? readJson(recordPath) : {};
const migration = fs.existsSync(migrationPath) ? readText(migrationPath) : "";
const protectedShell = fs.existsSync(protectedShellPath) ? readText(protectedShellPath) : "";
const workspaceScript = fs.existsSync(workspaceScriptPath) ? readText(workspaceScriptPath) : "";

assert(record.schema_version === "1.0", `${recordPath}: schema_version must be 1.0`);
assert(
  record.object_status === "protected_workspace_persistence_gate",
  `${recordPath}: object_status must be protected_workspace_persistence_gate`
);
assert(
  record.classification === "not_active_substrate_prepared_only",
  `${recordPath}: classification must remain substrate-only until live save/load and RLS are verified`
);

const substrate = record.repository_substrate || {};
assert(substrate.migration_path === migrationPath, `${recordPath}: migration path must match substrate file`);
assert(substrate.migration_exists === true, `${recordPath}: migration_exists must be true`);
assert(
  substrate.schema_sufficient_for_minimal_loop_if_applied === true,
  `${recordPath}: existing migration must be classified as sufficient only if applied`
);
assert(substrate.rls_policy_sql_present === true, `${recordPath}: RLS policy SQL flag must be true`);
assert(substrate.auth_uid_binding_present === true, `${recordPath}: auth.uid binding flag must be true`);

const requiredTables = ["workspaces", "workspace_memberships", "workspace_state_records", "workspace_events"];
for (const table of requiredTables) {
  assertIncludes(migration, `create table public.${table}`, `${migrationPath} table`);
  assertIncludes(migration, `alter table public.${table} enable row level security`, `${migrationPath} RLS`);
}

const requiredMigrationTerms = [
  "workspace_id uuid not null references public.workspaces(id) on delete cascade",
  "state_payload jsonb not null default '{}'::jsonb",
  "unique (workspace_id, record_type, record_key)",
  "auth.uid()",
  "public.is_workspace_member",
  "create policy",
  "Workspace members can read state records",
  "Workspace contributors can insert state records",
  "Workspace contributors can update state records"
];

for (const term of requiredMigrationTerms) {
  assertIncludes(migration, term, `${migrationPath} persistence/RLS term`);
}

const forbiddenSqlPatterns = [
  /using\s*\(\s*true\s*\)/i,
  /with\s+check\s*\(\s*true\s*\)/i,
  /\bto\s+public\b/i,
  /\bgrant\s+all\b/i,
  /\bservice_role\b/i,
  /\banon\b[^;\n]*(insert|update|delete)/i
];

for (const pattern of forbiddenSqlPatterns) {
  assert(!pattern.test(migration), `${migrationPath}: forbidden broad policy or role pattern ${pattern}`);
}

const liveGate = record.live_project_gate || {};
for (const field of [
  "supabase_cli_available_in_codex_environment",
  "supabase_project_link_detected",
  "safe_live_schema_inspection_available",
  "safe_live_migration_application_available",
  "migration_applied_live",
  "live_schema_verified",
  "rls_verified_live",
  "cross_user_isolation_verified"
]) {
  assert(liveGate[field] === false, `${recordPath}: live_project_gate.${field} must be false in this gated pass`);
}

const wiring = record.protected_shell_wiring || {};
assert(wiring.save_workspace_state_action_added === false, `${recordPath}: save action must not be marked added`);
assert(wiring.load_saved_workspace_state_action_added === false, `${recordPath}: load action must not be marked added`);
assert(wiring.supabase_read_write_logic_added === false, `${recordPath}: Supabase read/write logic must not be marked added`);

assertNotIncludes(protectedShell, "Save workspace state", `${protectedShellPath} gated save UI`);
assertNotIncludes(protectedShell, "Load saved workspace state", `${protectedShellPath} gated load UI`);
assertNotIncludes(workspaceScript, ".from(", `${workspaceScriptPath} database access before live schema verification`);
assertNotMatches(workspaceScript, /\.(upsert|insert|update|select)\s*\(/, `${workspaceScriptPath} query call before live schema verification`);

const verification = record.verification_status || {};
for (const field of [
  "authenticated_save_verified",
  "reload_load_verified",
  "logged_out_denial_verified",
  "cross_user_denial_verified",
  "backend_activation_claimed"
]) {
  assert(verification[field] === false, `${recordPath}: verification_status.${field} must be false`);
}

const operator = record.operator_action_required || {};
assert(operator.apply_or_verify_migration === true, `${recordPath}: operator migration action must be required`);
assert(operator.migration_path === migrationPath, `${recordPath}: operator migration path must match`);
assert(operator.backend_activation_after_this_pass === false, `${recordPath}: backend activation must remain false`);

const scannedForSecrets = [protectedShell, workspaceScript, migration, JSON.stringify(record)].join("\n");
const forbiddenSecretPatterns = [
  /SUPABASE_SERVICE_ROLE/,
  /\bservice_role\b/i,
  /JWT_SECRET/,
  /PRIVATE_KEY/,
  /BEGIN [A-Z ]*PRIVATE KEY/,
  /sk-[A-Za-z0-9]/
];

for (const pattern of forbiddenSecretPatterns) {
  assert(!pattern.test(scannedForSecrets), `secret/config boundary: forbidden pattern ${pattern}`);
}

const claimScan = [protectedShell, workspaceScript, JSON.stringify(record)].join("\n");
const forbiddenClaimPatterns = [
  /customer workspace exists/i,
  /tenant isolation exists/i,
  /production SaaS (exists|enabled|active|available)/i,
  /billing enabled/i,
  /monitoring enabled/i,
  /operational use achieved/i,
  /operational release authority/i,
  /production audit ledger (exists|enabled|active|available)/i,
  /public NEXUS runtime (exists|enabled|active|available)/i,
  /model API execution (exists|enabled|active|available)/i,
  /Palisade/i,
  /Weave/i,
  /compliance enforced/i,
  /release approved/i,
  /deployment approved/i
];

for (const pattern of forbiddenClaimPatterns) {
  assert(!pattern.test(claimScan), `claim boundary: forbidden positive claim ${pattern}`);
}

assertMatches(
  record.operator_action_required?.required_action || "",
  /verify tables, RLS enabled state, auth\.uid\(\)-bound policies, authenticated save\/load, logged-out denial, and cross-user denial/i,
  `${recordPath}: required operator action`
);

if (failures.length) {
  console.error("Protected workspace persistence validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Protected workspace persistence gate validation passed.");
console.log("Classification: not active, substrate prepared only.");
