import fs from "node:fs/promises";

const recordPath = "data/direct-ui-membrane-live-provider-loop-verification.v0.json";
const birthGatePath = "data/direct-ui-membrane-protected-shell-birth-gate.v0.json";
const loginRoutePath = "auth-login.html";
const callbackRoutePath = "auth-callback.html";
const protectedShellPath = "protected-shell.html";

const requiredTrueFlags = [
  "verification_performed",
  "verification_completed",
  "runtime_public_config_supplied_externally",
  "provider_login_verified",
  "callback_session_recognition_verified",
  "protected_shell_admission_verified",
  "protected_shell_denial_without_session_verified",
  "authenticated_surfaces_born"
];

const requiredFalseFlags = [
  "runtime_public_config_values_committed",
  "mock_stub_fake_session_used",
  "local_storage_session_storage_manipulation_used",
  "oauth_token_session_callback_user_payload_exposed",
  "backend_implemented",
  "database_access_implemented",
  "persistence_implemented",
  "rls_implemented",
  "tenant_isolation_implemented",
  "customer_workspace_implemented",
  "billing_implemented",
  "production_saas_claimed"
];

const rejectedBirthEvidence = [
  "static DOM inspection only",
  "unit test only",
  "smoke test only",
  "mocked session",
  "stubbed getSession",
  "fixture with session_present: true",
  "manually toggled DOM state",
  "browser localStorage/sessionStorage manipulation",
  "fake callback code",
  "fake user data",
  "static flag",
  "validator pass alone"
];

const boundedShellPhrases = [
  "Protected Shell Boundary",
  "Session recognized",
  "Authenticated save/load loop",
  "Session-scoped Supabase state",
  "No tenant workspace",
  "No customer data",
  "No billing",
  "No production SaaS"
];

function fail(message) {
  throw new Error(message);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

function assertIncludesAll(actual, expected, label) {
  for (const value of expected) {
    if (!actual.includes(value)) fail(`${label}: missing ${value}`);
  }
}

function assertFlags(record, flags, expected) {
  for (const flag of flags) {
    if (record[flag] !== expected) fail(`${recordPath}.${flag} must be ${expected}`);
  }
}

function assertRecordShape(record) {
  if (record.schema_version !== "0.1") fail("schema_version must be 0.1");
  if (
    record.generated_for_sub_pass !==
    "§1.2 Supabase Auth Storage Live Verification 0.1 — Callback Session Recognition / Protected Shell Admission"
  ) {
    fail("generated_for_sub_pass mismatch");
  }
  if (record.baseline_commit !== "dffde0257535fad80c60d9fbd288c828f7326a70") {
    fail("baseline_commit mismatch");
  }
  if (record.object_status !== "live_provider_loop_verification") fail("object_status mismatch");
  if (record.verification_blocker !== "none") fail("verification_blocker must be none");
  if (record.provider !== "github") fail("provider must be github");
  if (record.runtime_public_config_global !== "AETHERUS_SUPABASE_PUBLIC_CONFIG") {
    fail("runtime_public_config_global mismatch");
  }
}

function assertDeployedChecks(record) {
  const runtime = record.deployed_runtime_config_check || {};
  for (const flag of [
    "runtime_config_artifact_http_200",
    "runtime_config_parseable_javascript",
    "runtime_config_global_present",
    "auth_storage_deployed_configuration_verified"
  ]) {
    if (runtime[flag] !== true) fail(`deployed_runtime_config_check.${flag} must be true`);
  }
  if (runtime.runtime_config_values_printed_logged_or_exposed !== false) {
    fail("runtime config values must not be printed, logged, or exposed");
  }

  const order = record.deployed_auth_page_load_order || {};
  for (const flag of [
    "auth_login_runtime_config_before_auth_module",
    "auth_callback_runtime_config_before_auth_module",
    "protected_shell_runtime_config_before_auth_module"
  ]) {
    if (order[flag] !== true) fail(`deployed_auth_page_load_order.${flag} must be true`);
  }
}

function assertLiveSurface(record) {
  const live = record.live_deployed_surface_checked || {};
  const requiredLiveTrue = [
    "auth_login_route_checked",
    "provider_login_initiation_attempted_through_deployed_auth_login",
    "provider_login_initiation_verified",
    "github_oauth_provider_reached",
    "supabase_app_callback_route_reached",
    "protected_shell_boundary_link_exposed_after_session_recognition",
    "protected_shell_route_reached",
    "protected_shell_denial_without_session_protected_content_hidden"
  ];
  for (const flag of requiredLiveTrue) {
    if (live[flag] !== true) fail(`live_deployed_surface_checked.${flag} must be true`);
  }
  if (live.callback_visible_heading !== "Session recognized") fail("callback heading mismatch");
  if (live.callback_visible_status !== "Callback exchange classified") {
    fail("callback visible status mismatch");
  }
  if (live.callback_status_state !== "callback_exchange_attempted") fail("callback state mismatch");
  if (live.protected_shell_visible_heading !== "Protected Shell Boundary") {
    fail("protected shell page heading mismatch");
  }
  if (live.protected_shell_guard_heading !== "Session recognized") {
    fail("protected shell guard heading mismatch");
  }
  if (live.protected_shell_visible_status !== "Session recognized") {
    fail("protected shell status mismatch");
  }
  if (live.protected_shell_status_state !== "guard_permitted_without_shell_entry") {
    fail("protected shell state mismatch");
  }
  if (live.protected_shell_denial_without_session_state !== "Session absent") {
    fail("no-session denial state mismatch");
  }
  if (live.protected_shell_denial_without_session_heading !== "Access denied") {
    fail("no-session denial heading mismatch");
  }
}

if (!(await exists(recordPath))) fail(`${recordPath} is missing`);
if (!(await exists(birthGatePath))) fail(`${birthGatePath} is missing`);
for (const filePath of [loginRoutePath, callbackRoutePath, protectedShellPath]) {
  if (!(await exists(filePath))) fail(`${filePath} is missing`);
}

const record = await readJson(recordPath);
const birthGate = await readJson(birthGatePath);

assertRecordShape(record);
assertFlags(record, requiredTrueFlags, true);
assertFlags(record, requiredFalseFlags, false);
assertDeployedChecks(record);
assertLiveSurface(record);
assertIncludesAll(
  record.not_birth_evidence_rejected || [],
  rejectedBirthEvidence,
  "not_birth_evidence_rejected"
);

const notes = record.verification_notes || [];
assertIncludesAll(notes, [
  "An initial manual OAuth return landed on a non-sensitive invalid_request / bad_oauth_state error at the site root and did not count as callback evidence.",
  "A fresh deployed provider login attempt then reached the app callback route, recognized a real Supabase session after callback exchange, exposed the Protected Shell Boundary link, and admitted protected-shell.html through the Supabase session guard.",
  "No mocked, stubbed, or fake session evidence was used; no browser storage was manually manipulated; no callback code, token, session, user payload, PKCE verifier, or runtime config value was printed, logged, exposed, or committed."
], "verification_notes");

if (!record.birth_scope.includes("does not create backend")) fail("birth_scope must preserve backend boundary");

if (birthGate.authenticated_surfaces_born !== true) {
  fail(`${birthGatePath}.authenticated_surfaces_born must be true`);
}
if (
  birthGate.authenticated_surfaces_birth_verification !==
  "verified_real_provider_callback_and_protected_shell_admission_after_auth_storage"
) {
  fail(`${birthGatePath}.authenticated_surfaces_birth_verification mismatch`);
}

const loginText = await readText(loginRoutePath);
if (!loginText.includes("Continue with GitHub")) fail(`${loginRoutePath} missing GitHub action`);
if (/<input\b/i.test(loginText) || /<form\b/i.test(loginText)) {
  fail(`${loginRoutePath} must not contain credential fields`);
}

const callbackText = await readText(callbackRoutePath);
if (/<input\b/i.test(callbackText) || /<form\b/i.test(callbackText)) {
  fail(`${callbackRoutePath} must not contain credential fields`);
}

const protectedShellText = await readText(protectedShellPath);
assertIncludesAll(protectedShellText, boundedShellPhrases, protectedShellPath);

console.log("direct ui membrane live provider loop verification record ok (live auth storage verification succeeded)");
