import fs from "node:fs/promises";

const recordPath = "data/direct-ui-membrane-live-provider-loop-verification.v0.json";
const birthGatePath = "data/direct-ui-membrane-protected-shell-birth-gate.v0.json";
const loginRoutePath = "auth-login.html";
const callbackRoutePath = "auth-callback.html";
const protectedShellPath = "protected-shell.html";

const requiredFalseFlags = [
  "runtime_public_config_supplied_externally",
  "runtime_public_config_values_committed",
  "provider_login_verified",
  "callback_session_recognition_verified",
  "protected_shell_admission_verified",
  "authenticated_surfaces_born",
  "mock_stub_fake_session_used",
  "backend_implemented",
  "database_access_implemented",
  "persistence_implemented",
  "rls_implemented",
  "tenant_isolation_implemented",
  "customer_workspace_implemented",
  "billing_implemented",
  "production_saas_claimed"
];

const invalidBirthEvidence = [
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
  "No database access",
  "No persistence layer",
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

function assertFalseFlags(record) {
  for (const flag of requiredFalseFlags) {
    if (record[flag] !== false) fail(`${recordPath}.${flag} must be false`);
  }
}

if (!(await exists(recordPath))) fail(`${recordPath} is missing`);
if (!(await exists(birthGatePath))) fail(`${birthGatePath} is missing`);
for (const filePath of [loginRoutePath, callbackRoutePath, protectedShellPath]) {
  if (!(await exists(filePath))) fail(`${filePath} is missing`);
}

const record = await readJson(recordPath);
const birthGate = await readJson(birthGatePath);

if (record.schema_version !== "0.1") fail("schema_version must be 0.1");
if (
  record.generated_for_sub_pass !==
  "§1.2 Supabase Implementation 0.7 — Live Provider Loop Verification"
) {
  fail("generated_for_sub_pass mismatch");
}
if (record.baseline_commit !== "fe0990837218309fac9ca69c9f10da7ba14e8609") {
  fail("baseline_commit mismatch");
}
if (record.object_status !== "live_provider_loop_verification") fail("object_status mismatch");
if (record.verification_performed !== false) fail("verification_performed must remain false");
if (record.verification_completed !== false) fail("verification_completed must remain false");
if (record.verification_blocker !== "runtime_public_config_not_supplied") {
  fail("verification_blocker mismatch");
}
if (record.provider !== "github") fail("provider must be github");
if (record.runtime_public_config_global !== "AETHERUS_SUPABASE_PUBLIC_CONFIG") {
  fail("runtime_public_config_global mismatch");
}
if (record.protected_shell_denial_without_session_verified !== true) {
  fail("protected_shell_denial_without_session_verified must be true");
}

assertFalseFlags(record);
assertIncludesAll(record.not_birth_evidence || [], invalidBirthEvidence, "not_birth_evidence");

const localCheck = record.local_static_surface_checked || {};
if (localCheck.server_origin !== "http://127.0.0.1:4173") {
  fail("local_static_surface_checked.server_origin mismatch");
}
for (const flag of [
  "auth_login_route_checked",
  "auth_callback_route_checked",
  "protected_shell_route_checked"
]) {
  if (localCheck[flag] !== true) fail(`local_static_surface_checked.${flag} must be true`);
}
if (localCheck.runtime_public_config_global_present_in_browser !== false) {
  fail("runtime public config must not be reported present");
}
if (localCheck.protected_shell_denial_state !== "Runtime public config unavailable") {
  fail("protected shell denial state mismatch");
}

const notes = record.verification_notes || [];
assertIncludesAll(notes, [
  "The local static browser check found no externally supplied AETHERUS_SUPABASE_PUBLIC_CONFIG object.",
  "Provider login, callback session recognition, and protected shell admission were not marked verified because no real Supabase provider-backed session was available."
], "verification_notes");

if (birthGate.authenticated_surfaces_born !== false) {
  fail(`${birthGatePath}.authenticated_surfaces_born must remain false`);
}
if (
  birthGate.authenticated_surfaces_birth_verification !==
  "unverified_runtime_config_unavailable"
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

console.log("direct ui membrane live provider loop verification record ok (blocked by missing runtime public config)");
