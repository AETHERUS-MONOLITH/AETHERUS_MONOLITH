import fs from "node:fs";

const recordPath = "data/direct-ui-membrane-protected-workspace-persistence.v0.json";
const migrationPath = "supabase/migrations/20260619_0001_tenant_workspace_substrate.sql";
const protectedShellPath = "protected-shell.html";
const workspaceScriptPath = "js/protected-workspace.js";
const callbackScriptPath = "js/supabase-auth-callback.js";

const workspaceTables = ["workspace_events", "workspace_memberships", "workspace_state_records", "workspaces"];
const rolesWithPrivilegeHygiene = ["anon", "authenticated"];
const normalDmlPrivileges = ["SELECT", "INSERT", "UPDATE", "DELETE"];
const expectedAuthenticatedDmlPrivileges = {
  workspace_events: ["SELECT", "INSERT"],
  workspace_memberships: ["SELECT", "INSERT", "UPDATE"],
  workspace_state_records: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  workspaces: ["SELECT", "INSERT", "UPDATE"]
};
const expectedPostCheckGrants = {
  anon: {
    workspace_events: ["REFERENCES"],
    workspace_memberships: ["REFERENCES"],
    workspace_state_records: ["REFERENCES"],
    workspaces: ["REFERENCES"]
  },
  authenticated: {
    workspace_events: ["SELECT", "INSERT", "REFERENCES"],
    workspace_memberships: ["SELECT", "INSERT", "UPDATE", "REFERENCES"],
    workspace_state_records: ["SELECT", "INSERT", "UPDATE", "DELETE", "REFERENCES"],
    workspaces: ["SELECT", "INSERT", "UPDATE", "REFERENCES"]
  }
};

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

function assertArrayEquals(actual, expected, label) {
  assert(Array.isArray(actual), `${label}: must be an array`);
  assert(actual.length === expected.length, `${label}: length mismatch`);
  for (const value of expected) {
    assert(actual.includes(value), `${label}: missing ${value}`);
  }
  for (const value of actual || []) {
    assert(expected.includes(value), `${label}: unexpected ${value}`);
  }
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
  record.classification === "bounded_protected_shell_persistence_verified_in_tested_external_live_browser_path",
  `${recordPath}: classification must record only the tested bounded live browser path`
);
assert(record.baseline_commit === "96db91a92071d0fc7636495aa11613cf499202ab", `${recordPath}: baseline commit mismatch`);

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

const externalConfig = record.external_supabase_configuration_evidence || {};
assert(
  externalConfig.evidence_source === "external live verification already established outside this repository pass",
  `${recordPath}: Supabase configuration evidence source mismatch`
);
assert(externalConfig.project === "aetherus-monolith-dev", `${recordPath}: Supabase configuration project mismatch`);
assert(
  externalConfig.github_provider_flow_reaches_canonical_custom_domain_callback_path === true,
  `${recordPath}: canonical callback provider evidence missing`
);
assert(externalConfig.canonical_custom_domain_callback_path_verified === true, `${recordPath}: callback path evidence missing`);
assert(externalConfig.supabase_github_provider_flow_verified === true, `${recordPath}: provider flow evidence missing`);
assert(
  externalConfig.codex_live_supabase_configuration_change_performed === false,
  `${recordPath}: this pass must not perform live Supabase configuration changes`
);

const liveBrowser = record.external_live_browser_verification_evidence || {};
assert(
  liveBrowser.evidence_source === "external live browser verification already established outside this repository pass",
  `${recordPath}: live browser evidence source mismatch`
);
assert(liveBrowser.tested_surface === protectedShellPath, `${recordPath}: tested surface mismatch`);
assert(liveBrowser.authentication_path === "GitHub through Supabase", `${recordPath}: authentication path mismatch`);
assert(liveBrowser.session_recognition_after_authentication === "SESSION RECOGNIZED", `${recordPath}: session recognition evidence missing`);
assert(liveBrowser.protected_workspace_frame_visible === true, `${recordPath}: protected workspace frame evidence missing`);
assert(
  liveBrowser.bounded_save_load_persistence_verified_for ===
    "workspace/release-review state in the tested protected-shell live browser path",
  `${recordPath}: bounded persistence scope must be exact`
);
assert(liveBrowser.bounded_save_load_persistence_verified === true, `${recordPath}: bounded save/load evidence missing`);
assert(
  liveBrowser.direct_unauthenticated_incognito_access_result === "SESSION NOT RECOGNIZED",
  `${recordPath}: unauthenticated denial result missing`
);
assert(liveBrowser.unauthenticated_denial_verified === true, `${recordPath}: unauthenticated denial evidence missing`);
assert(
  liveBrowser.two_account_browser_level_workspace_state_separation_verified === true,
  `${recordPath}: two-account browser-level separation evidence missing`
);
assert(
  liveBrowser.two_account_browser_level_workspace_state_separation_detail ===
    "Account B loaded its own recent saved timestamp/content, not Account A's saved state.",
  `${recordPath}: two-account separation detail mismatch`
);
assert(
  liveBrowser.two_account_browser_level_separation_is_not_tenant_isolation_maturity === true,
  `${recordPath}: two-account browser-level separation must not be tenant-isolation maturity`
);
assert(
  liveBrowser.first_persistence_verification_is_not_production_authorization_maturity === true,
  `${recordPath}: first persistence verification must not be production authorization maturity`
);
assert(liveBrowser.codex_live_browser_verification_performed === false, `${recordPath}: Codex live browser verification must remain false`);

const sqlRls = record.external_sql_rls_verification_evidence || {};
assert(
  sqlRls.evidence_source === "external SQL/RLS verification already established outside this repository pass",
  `${recordPath}: SQL/RLS evidence source mismatch`
);
assert(sqlRls.project === "aetherus-monolith-dev", `${recordPath}: SQL/RLS project mismatch`);
assertArrayEquals(
  sqlRls.tables_verified,
  ["public.workspaces", "public.workspace_memberships", "public.workspace_state_records", "public.workspace_events"],
  `${recordPath}: SQL/RLS tables_verified`
);
for (const table of workspaceTables) {
  assert(sqlRls.rls_enabled?.[table] === true, `${recordPath}: RLS enabled evidence missing for ${table}`);
}
const policyInspection = sqlRls.policy_inspection || {};
assert(policyInspection.policy_count === 12, `${recordPath}: policy count must be 12`);
assert(policyInspection.constrained_by_auth_uid === true, `${recordPath}: auth.uid policy constraint missing`);
assert(
  policyInspection.constrained_by_owner_user_id_equals_auth_uid === true,
  `${recordPath}: owner_user_id = auth.uid() policy constraint missing`
);
assert(policyInspection.constrained_by_is_workspace_member === true, `${recordPath}: is_workspace_member policy constraint missing`);
assert(
  policyInspection.constraint_summary ===
    "12 policies are present and constrained through auth.uid(), owner_user_id = auth.uid(), and/or is_workspace_member(...).",
  `${recordPath}: policy constraint summary mismatch`
);
assert(sqlRls.codex_live_sql_rls_verification_performed === false, `${recordPath}: Codex SQL/RLS verification must remain false`);

const privilegeHygiene = record.external_grants_privilege_hygiene_evidence || {};
assert(
  privilegeHygiene.evidence_source ===
    "external grants/privilege hygiene verification already established outside this repository pass",
  `${recordPath}: grants evidence source mismatch`
);
assert(
  privilegeHygiene.anon_normal_dml_privileges_on_workspace_tables === false,
  `${recordPath}: anon must have no normal DML privileges on workspace tables`
);
for (const [table, expected] of Object.entries(expectedAuthenticatedDmlPrivileges)) {
  assertArrayEquals(
    privilegeHygiene.authenticated_bounded_dml_privileges_required_for_persistence_substrate?.[table],
    expected,
    `${recordPath}: authenticated bounded DML privileges for ${table}`
  );
}
for (const role of rolesWithPrivilegeHygiene) {
  for (const table of workspaceTables) {
    const cell = privilegeHygiene.truncate_trigger_absence?.[role]?.[table] || {};
    assert(cell.has_truncate === false, `${recordPath}: ${role}/${table} must not have TRUNCATE`);
    assert(cell.has_trigger === false, `${recordPath}: ${role}/${table} must not have TRIGGER`);
  }
}
for (const [role, grantsByTable] of Object.entries(expectedPostCheckGrants)) {
  for (const [table, expected] of Object.entries(grantsByTable)) {
    assertArrayEquals(
      privilegeHygiene.post_check_grants_shape?.[role]?.[table],
      expected,
      `${recordPath}: post-check grants for ${role}/${table}`
    );
  }
}
for (const table of workspaceTables) {
  const anonGrants = privilegeHygiene.post_check_grants_shape?.anon?.[table] || [];
  for (const privilege of normalDmlPrivileges) {
    assert(!anonGrants.includes(privilege), `${recordPath}: anon/${table} must not include normal DML ${privilege}`);
  }
}
const referencesClassification = privilegeHygiene.references_classification || {};
assert(
  referencesClassification.non_blocking_least_privilege_hardening_note === true,
  `${recordPath}: REFERENCES must be a non-blocking hardening note`
);
assert(referencesClassification.normal_dml === false, `${recordPath}: REFERENCES must not be treated as normal DML`);
assert(referencesClassification.pass_failure_reason === false, `${recordPath}: REFERENCES must not fail this pass`);
assert(
  referencesClassification.evidence_of_tenant_isolation_maturity === false,
  `${recordPath}: REFERENCES must not evidence tenant-isolation maturity`
);
assert(
  privilegeHygiene.codex_live_grants_privilege_verification_performed === false,
  `${recordPath}: Codex grants verification must remain false`
);

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
for (const field of [
  "external_live_browser_bounded_save_load_verified",
  "external_live_browser_unauthenticated_denial_verified",
  "external_live_browser_two_account_browser_level_separation_verified",
  "external_live_sql_rls_substrate_verified",
  "external_live_grants_privilege_hygiene_verified"
]) {
  assert(verification[field] === true, `${recordPath}: verification_status.${field} must be true`);
}
assert(
  verification.backend_persistence_claim_after_this_pass ===
    "bounded protected-shell save/load persistence for workspace/release-review state is externally verified in the tested live browser path only",
  `${recordPath}: backend persistence claim must stay bounded`
);

const claimable = record.claimable_narrow_state || {};
assert(claimable.bounded_protected_shell_persistence_loop_verified === true, `${recordPath}: bounded claimable state missing`);
assert(
  claimable.claim ===
    "Protected-shell bounded save/load persistence works for workspace/release-review state in the tested live browser path after GitHub-through-Supabase authentication.",
  `${recordPath}: claimable narrow state must remain bounded`
);
assert(
  claimable.repository_baseline_recorded === "96db91a92071d0fc7636495aa11613cf499202ab",
  `${recordPath}: claimable baseline mismatch`
);
assert(
  claimable.external_evidence_not_repo_generated_proof === true,
  `${recordPath}: external evidence must not be represented as repo-generated proof`
);

const notClaimable = record.not_claimable_maturity_states || {};
for (const field of [
  "production_saas",
  "customer_workspace_maturity",
  "tenant_isolation_maturity",
  "broad_authorization_assurance",
  "operational_use",
  "operational_release_authority",
  "production_audit_ledger",
  "billing_maturity",
  "monitoring_maturity",
  "mfa_maturity",
  "team_management_maturity",
  "account_recovery_maturity",
  "palisade_birth",
  "weave_birth",
  "public_nexus_runtime",
  "model_api_execution",
  "production_authorization_maturity"
]) {
  assert(notClaimable[field] === false, `${recordPath}: not_claimable_maturity_states.${field} must be false`);
}

const hardeningNotes = record.non_blocking_hardening_notes || [];
assert(Array.isArray(hardeningNotes) && hardeningNotes.length === 1, `${recordPath}: expected one hardening note`);
const referencesNote = hardeningNotes[0] || {};
assert(
  referencesNote.subject === "REFERENCES grants remain visible for anon and authenticated on the four workspace tables.",
  `${recordPath}: REFERENCES hardening note subject mismatch`
);
assert(
  referencesNote.classification === "non-blocking least-privilege hardening note",
  `${recordPath}: REFERENCES hardening note classification mismatch`
);
assert(referencesNote.normal_dml === false, `${recordPath}: REFERENCES hardening note must not classify REFERENCES as normal DML`);
assert(referencesNote.pass_failure_reason === false, `${recordPath}: REFERENCES hardening note must not fail the pass`);
assert(
  referencesNote.tenant_isolation_maturity_evidence === false,
  `${recordPath}: REFERENCES hardening note must not evidence tenant-isolation maturity`
);

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
console.log("Classification: bounded protected-shell persistence verified in tested external live browser path only.");
