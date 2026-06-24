import fs from "node:fs";

const recordPath = "data/direct-ui-membrane-protected-workspace-persistence.v0.json";
const migrationPath = "supabase/migrations/20260619_0001_tenant_workspace_substrate.sql";
const protectedShellPath = "protected-shell.html";
const workspaceScriptPath = "js/protected-workspace.js";
const callbackScriptPath = "js/supabase-auth-callback.js";

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

for (const filePath of [recordPath, migrationPath, protectedShellPath, workspaceScriptPath, callbackScriptPath]) {
  if (!fs.existsSync(filePath)) fail(`${filePath} is missing`);
}

const record = fs.existsSync(recordPath) ? readJson(recordPath) : {};
const migration = fs.existsSync(migrationPath) ? readText(migrationPath) : "";
const protectedShell = fs.existsSync(protectedShellPath) ? readText(protectedShellPath) : "";
const workspaceScript = fs.existsSync(workspaceScriptPath) ? readText(workspaceScriptPath) : "";
const callbackScript = fs.existsSync(callbackScriptPath) ? readText(callbackScriptPath) : "";

assert(record.schema_version === "1.0", `${recordPath}: schema_version must be 1.0`);
assert(
  record.object_status === "protected_workspace_persistence_wiring",
  `${recordPath}: object_status must describe persistence wiring`
);
assert(
  record.classification === "partially_active_repository_wiring_present_live_browser_verification_pending",
  `${recordPath}: classification must preserve live browser verification boundary`
);

const substrate = record.repository_substrate || {};
assert(substrate.migration_path === migrationPath, `${recordPath}: migration path must match substrate file`);
assert(substrate.migration_exists === true, `${recordPath}: migration_exists must be true`);
assert(substrate.rls_policy_sql_present === true, `${recordPath}: RLS policy SQL flag must be true`);
assert(substrate.auth_uid_binding_present === true, `${recordPath}: auth.uid binding flag must be true`);

const requiredTables = ["workspaces", "workspace_memberships", "workspace_state_records", "workspace_events"];
for (const table of requiredTables) {
  assertIncludes(migration, `create table public.${table}`, `${migrationPath} table`);
  assertIncludes(migration, `alter table public.${table} enable row level security`, `${migrationPath} RLS`);
}

for (const table of ["workspaces", "workspace_memberships", "workspace_state_records"]) {
  assert(substrate.tables_used_by_wiring?.includes(table), `${recordPath}: tables_used_by_wiring missing ${table}`);
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
  new RegExp("\\bservice" + "_role\\b", "i"),
  /\banon\b[^;\n]*(insert|update|delete)/i
];

for (const pattern of forbiddenSqlPatterns) {
  assert(!pattern.test(migration), `${migrationPath}: forbidden broad policy or role pattern ${pattern}`);
}

const external = record.external_live_substrate_evidence || {};
assert(external.operator_reported_project === "aetherus-monolith-dev", `${recordPath}: project evidence mismatch`);
assert(external.operator_reported_migration_applied_live === true, `${recordPath}: external migration evidence missing`);
assert(external.operator_reported_live_tables_verified === true, `${recordPath}: external table evidence missing`);
assert(external.operator_reported_rls_enabled === true, `${recordPath}: external RLS evidence missing`);
assert(external.operator_reported_authenticated_policies_present === true, `${recordPath}: external policy evidence missing`);
assert(external.operator_reported_policy_rows === 12, `${recordPath}: external policy row count mismatch`);
assert(external.operator_reported_broad_unconstrained_policy_check_rows === 0, `${recordPath}: broad policy evidence mismatch`);
assert(external.codex_live_database_inspection_performed === false, `${recordPath}: Codex live DB inspection must remain false`);
assert(external.codex_supabase_cli_work_performed === false, `${recordPath}: Codex Supabase CLI work must remain false`);

const wiring = record.protected_shell_wiring || {};
assert(
  wiring.callback_success_auto_enters_protected_shell === true,
  `${recordPath}: callback success auto-entry flag must be true`
);
assert(
  wiring.callback_success_auto_entry_script === callbackScriptPath,
  `${recordPath}: callback success auto-entry script mismatch`
);
assert(
  wiring.callback_success_auto_entry_target === protectedShellPath,
  `${recordPath}: callback success auto-entry target mismatch`
);
for (const field of [
  "save_workspace_state_action_added",
  "load_saved_workspace_state_action_added",
  "supabase_read_write_logic_added",
  "session_required_before_persistence",
  "save_requires_staged_candidate",
  "load_attempted_after_reentry",
  "workspace_bootstrap_on_save",
  "local_trace_events_for_save_load"
]) {
  assert(wiring[field] === true, `${recordPath}: protected_shell_wiring.${field} must be true`);
}
assert(wiring.workspace_mutation_on_load === false, `${recordPath}: load must not mutate workspace rows`);

const requiredShellPhrases = [
  "Save workspace state",
  "Load saved workspace state",
  "Persistence status",
  "unsaved",
  "bounded release-review workspace state",
  "No operational evidence ledger",
  "No tenant workspace",
  "No customer data",
  "No production SaaS"
];

for (const phrase of requiredShellPhrases) {
  assertIncludes(protectedShell, phrase, protectedShellPath);
}

const requiredScriptPhrases = [
  "initializeSupabaseBrowserClient",
  "auth.getSession",
  "saveWorkspaceState",
  "loadSavedWorkspaceState",
  "session required",
  "backend unavailable",
  "persistence unavailable",
  "no saved workspace state",
  "Save workspace state attempt started.",
  "Save workspace state succeeded.",
  "Load saved workspace state attempt started.",
  "Load saved workspace state succeeded.",
  "release_review_workspace_state",
  "protected-shell-release-review-v0",
  "workspace_state_records",
  "workspace_memberships",
  "workspaces"
];

for (const phrase of requiredScriptPhrases) {
  assertIncludes(workspaceScript, phrase, workspaceScriptPath);
}

for (const phrase of [
  'new URL("protected-shell.html", globalThis.location.href)',
  "globalThis.location.assign",
  "handleSupabaseAuthCallbackPrecondition"
]) {
  assertIncludes(callbackScript, phrase, callbackScriptPath);
}

const requiredQueryPatterns = [
  /\.from\("workspaces"\)\s*[\s\S]*?\.upsert\(/,
  /\.from\("workspace_memberships"\)\s*[\s\S]*?\.upsert\(/,
  /\.from\("workspace_state_records"\)\s*[\s\S]*?\.upsert\(/,
  /\.from\("workspace_state_records"\)\s*[\s\S]*?\.select\(/,
  /\.eq\("workspace_id"/,
  /\.eq\("record_type"/,
  /\.eq\("record_key"/,
  /\.maybeSingle\(\)/
];

for (const pattern of requiredQueryPatterns) {
  assertMatches(workspaceScript, pattern, `${workspaceScriptPath} Supabase persistence query`);
}

const forbiddenBrowserPatterns = [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bdocument\.cookie\b/,
  /\bnavigator\.serviceWorker\b/,
  new RegExp("SUPABASE_" + "SERVICE_ROLE"),
  new RegExp("\\bservice" + "_role\\b", "i"),
  new RegExp("JWT_" + "SECRET"),
  new RegExp("PRIVATE" + "_KEY"),
  new RegExp("BEGIN [A-Z ]*PRIVATE " + "KEY"),
  /sk-[A-Za-z0-9]/
];

for (const pattern of forbiddenBrowserPatterns) {
  assertNotMatches(workspaceScript, pattern, `${workspaceScriptPath} secret/storage boundary`);
  assertNotMatches(protectedShell, pattern, `${protectedShellPath} secret/storage boundary`);
}

assertNotIncludes(workspaceScript, "workspace_events", `${workspaceScriptPath} must not persist fake operational events`);
assertNotMatches(workspaceScript, /fake customer|customer_name|customer_id|customerData/, `${workspaceScriptPath} must not persist fake customer data`);
assertNotMatches(workspaceScript, /fake tenant|tenant_id|tenantData/, `${workspaceScriptPath} must not persist fake tenant data`);
assertNotIncludes(workspaceScript, "release approved", `${workspaceScriptPath} must not approve release`);
assertNotIncludes(workspaceScript, "deployment approved", `${workspaceScriptPath} must not approve deployment`);

const verification = record.verification_status || {};
assert(verification.operator_reported_live_sql_rls_substrate_verified === true, `${recordPath}: external SQL/RLS verification must be recorded`);
for (const field of [
  "authenticated_save_verified_by_codex",
  "reload_load_verified_by_codex",
  "logged_out_denial_verified_by_codex",
  "cross_user_denial_verified_by_codex",
  "backend_activation_claimed"
]) {
  assert(verification[field] === false, `${recordPath}: verification_status.${field} must remain false until live browser verification`);
}

const boundaries = record.boundaries || {};
for (const field of [
  "no_privileged_server_key_added",
  "no_secret_committed",
  "no_browser_rls_bypass",
  "no_client_side_filtering_as_authorization",
  "no_customer_workspace_claim",
  "no_tenant_isolation_maturity_claim",
  "no_production_saas_claim",
  "no_operational_use_claim",
  "no_operational_release_authority_claim",
  "no_production_audit_ledger_claim",
  "no_taa_or_doi_change"
]) {
  assert(boundaries[field] === true, `${recordPath}: boundaries.${field} must be true`);
}

const claimScan = [protectedShell, workspaceScript, JSON.stringify(record)].join("\n");
const forbiddenClaimPatterns = [
  /customer workspace exists/i,
  /tenant isolation (exists|mature|verified)/i,
  /production SaaS (exists|enabled|active|available)/i,
  /billing enabled/i,
  /monitoring enabled/i,
  /operational use achieved/i,
  /operational release authority/i,
  /production audit ledger (exists|enabled|active|available)/i,
  /public NEXUS runtime (exists|enabled|active|available)/i,
  /model API execution (exists|enabled|active|available)/i,
  /Palisade (exists|enabled|active|available|implemented)/i,
  /Weave (exists|enabled|active|available|implemented)/i,
  /compliance enforced/i,
  /release approved/i,
  /deployment approved/i
];

for (const pattern of forbiddenClaimPatterns) {
  assert(!pattern.test(claimScan), `claim boundary: forbidden positive claim ${pattern}`);
}

if (failures.length) {
  console.error("Protected workspace persistence validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Protected workspace persistence wiring validation passed.");
console.log("Classification: repository wiring present; live browser verification pending.");
