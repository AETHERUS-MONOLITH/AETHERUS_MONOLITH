import fs from "node:fs/promises";

const recordPath = "data/direct-ui-membrane-callback-exchange-diagnostics.v0.json";
const authStorageImplementationPath = "data/direct-ui-membrane-auth-storage-implementation.v0.json";
const clientPath = "js/supabase-client.js";
const loginPath = "js/supabase-login-initiation.js";
const preconditionPath = "js/supabase-auth-precondition.js";
const callbackScriptPath = "js/supabase-auth-callback.js";
const callbackPagePath = "auth-callback.html";
const loginPagePath = "auth-login.html";
const protectedShellPagePath = "protected-shell.html";
const runtimeConfigArtifactPath = "js/aetherus-runtime-config.js";
const envExamplePath = ".env.example";

const forbiddenEnvFiles = [
  ".env",
  ".env.local",
  ".env.production"
];

const authPages = [
  {
    page: loginPagePath,
    runtimeScript: runtimeConfigArtifactPath,
    authModule: "js/supabase-login-surface.js"
  },
  {
    page: callbackPagePath,
    runtimeScript: runtimeConfigArtifactPath,
    authModule: callbackScriptPath
  },
  {
    page: protectedShellPagePath,
    runtimeScript: runtimeConfigArtifactPath,
    authModule: "js/supabase-protected-shell.js"
  }
];

const forbiddenValuePatterns = [
  { label: "Supabase project URL", pattern: /https:\/\/[A-Za-z0-9-]+\.supabase\.co/i },
  { label: "Supabase key-like value", pattern: /\bsb_(?:publishable|anon|secret|service)_[A-Za-z0-9_-]{8,}/i },
  { label: "JWT-like token", pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
  { label: "OAuth token-like value", pattern: /\bgh[opsu]_[A-Za-z0-9_]{20,}/i }
];

const forbiddenRuntimeAdditions = [
  { label: "implicit fragment access-token handling", pattern: /location\.hash|access_token|refresh_token|provider_token/ },
  { label: "manual localStorage manipulation", pattern: /localStorage\.(?:setItem|getItem|removeItem)/ },
  { label: "manual sessionStorage manipulation", pattern: /sessionStorage\.(?:setItem|getItem|removeItem)/ },
  { label: "cookie persistence", pattern: /document\.cookie/ },
  { label: "manual setSession shortcut", pattern: /\.auth\.setSession\(/ },
  { label: "printed callback code or verifier", pattern: /console\.(?:log|debug|info|warn|error)\([^)]*(?:code|token|session|user|verifier)/is }
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

async function assertMissing(paths, label) {
  for (const filePath of paths) {
    if (await exists(filePath)) fail(`${label}: ${filePath} must not exist`);
  }
}

function assertIncludesAll(actual, expected, label) {
  for (const value of expected) {
    if (!actual.includes(value)) fail(`${label}: missing ${value}`);
  }
}

function scriptIndex(html, scriptPath) {
  return html.indexOf(`src="${scriptPath}"`);
}

async function assertRuntimeConfigOrder() {
  for (const { page, runtimeScript, authModule } of authPages) {
    const html = await readText(page);
    const runtimeIndex = scriptIndex(html, runtimeScript);
    const moduleIndex = scriptIndex(html, authModule);
    if (runtimeIndex === -1) fail(`${page} must load ${runtimeScript}`);
    if (moduleIndex === -1) fail(`${page} must load ${authModule}`);
    if (runtimeIndex > moduleIndex) fail(`${page} must load runtime config before auth module`);
  }
}

async function assertEnvExampleEmpty() {
  const text = await readText(envExamplePath);
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  for (const line of lines) {
    if (!line.includes("=")) fail(".env.example lines must be assignments");
    const [name, ...rest] = line.split("=");
    const value = rest.join("=");
    if (!name.startsWith("SUPABASE_")) fail(`.env.example contains disallowed name ${name}`);
    if (value !== "") fail(`.env.example ${name} must remain empty-valued`);
  }
}

function assertNoForbiddenValues(filePath, text) {
  for (const { label, pattern } of forbiddenValuePatterns) {
    if (pattern.test(text)) fail(`${filePath} contains forbidden ${label}`);
  }
}

function assertNoForbiddenRuntimeAdditions(filePath, text) {
  for (const { label, pattern } of forbiddenRuntimeAdditions) {
    if (pattern.test(text)) fail(`${filePath} contains forbidden ${label}`);
  }
}

async function assertClientBoundary(clientText) {
  if (!clientText.includes('flowType: "pkce"')) fail(`${clientPath} must keep PKCE flow`);
  if (await exists(authStorageImplementationPath)) {
    const authStorageImplementation = await readJson(authStorageImplementationPath);
    if (authStorageImplementation.bounded_supabase_auth_storage_implemented !== true) {
      fail(`${authStorageImplementationPath}.bounded_supabase_auth_storage_implemented must be true`);
    }
    if (!clientText.includes("persistSession: true")) {
      fail(`${clientPath} must implement the authorized bounded Supabase auth storage boundary`);
    }
  } else if (!clientText.includes("persistSession: false")) {
    fail(`${clientPath} must not add durable auth session persistence before the implementation pass`);
  }
  if (!clientText.includes("autoRefreshToken: false")) {
    fail(`${clientPath} must keep autoRefreshToken disabled`);
  }
  if (!clientText.includes("detectSessionInUrl: false")) {
    fail(`${clientPath} must keep automatic URL session detection disabled`);
  }
  if (clientText.includes("storage:")) {
    fail(`${clientPath} must not add a custom auth storage adapter in this diagnostics pass`);
  }
}

function assertCallbackExchangeBoundary(preconditionText) {
  if (!preconditionText.includes('params.get("code")')) {
    fail(`${preconditionPath} must keep reading callback query parameter code`);
  }
  if (!/clientResult\.client\.auth\.exchangeCodeForSession\(code\)/.test(preconditionText)) {
    fail(`${preconditionPath} must keep exchangeCodeForSession(code)`);
  }
  if (!preconditionText.includes("callback_exchange_failed")) {
    fail(`${preconditionPath} must retain non-sensitive callback exchange failure state`);
  }
  assertNoForbiddenRuntimeAdditions(preconditionPath, preconditionText);
}

function assertCallbackUiBoundary(callbackText, callbackPageText) {
  if (!callbackText.includes("entryLink.hidden = !sessionRecognized")) {
    fail(`${callbackScriptPath} must hide callback entry unless session is recognized`);
  }
  if (!callbackText.includes('stateLabels[result.state] || "Callback unavailable"')) {
    fail(`${callbackScriptPath} must display classified states without sensitive payloads`);
  }
  if (!callbackPageText.includes("data-callback-entry hidden")) {
    fail(`${callbackPagePath} must keep callback-specific protected-shell entry hidden by default`);
  }
  if (!callbackPageText.includes('href="protected-shell.html"')) {
    fail(`${callbackPagePath} static guarded-entry navigation expectation changed`);
  }
  assertNoForbiddenRuntimeAdditions(callbackScriptPath, callbackText);
}

function assertLoginBoundary(loginText) {
  if (!/clientResult\.client\.auth\.signInWithOAuth\(\{/.test(loginText)) {
    fail(`${loginPath} must retain bounded signInWithOAuth initiation`);
  }
  if (!loginText.includes("redirectTo: resolveRedirectTo(options.redirectTo)")) {
    fail(`${loginPath} must retain redirect target resolution`);
  }
  assertNoForbiddenRuntimeAdditions(loginPath, loginText);
}

if (!(await exists(recordPath))) fail(`${recordPath} is missing`);
if (await exists(runtimeConfigArtifactPath)) {
  fail(`${runtimeConfigArtifactPath} must not be committed as repository source`);
}

const record = await readJson(recordPath);
const clientText = await readText(clientPath);
const loginText = await readText(loginPath);
const preconditionText = await readText(preconditionPath);
const callbackText = await readText(callbackScriptPath);
const callbackPageText = await readText(callbackPagePath);

if (record.schema_version !== "0.1") fail("schema_version must be 0.1");
if (
  record.generated_for_sub_pass !==
  "§1.2 Supabase Callback Exchange Diagnostics 0.1 — PKCE Code Exchange Failure Boundary"
) {
  fail("generated_for_sub_pass mismatch");
}
if (record.baseline_commit !== "08971d5bfce8eb5229eef5641b7755a6b10021a7") {
  fail("baseline_commit mismatch");
}
if (record.object_status !== "supabase_callback_exchange_diagnostics") {
  fail("object_status mismatch");
}
if (record.observed_blocker_being_addressed !== "callback_exchange_failed_after_pkce_alignment") {
  fail("observed blocker mismatch");
}
if (record.active_blocker !== "pkce_callback_code_returned_but_exchange_failed") {
  fail("active blocker mismatch");
}

for (const flag of [
  "diagnostics_performed",
  "runtime_config_script_order_preserved"
]) {
  if (record[flag] !== true) fail(`${recordPath}.${flag} must be true`);
}

for (const flag of [
  "minimal_fix_implemented",
  "supabase_client_configuration_changed",
  "callback_handler_changed",
  "provider_login_initiation_changed",
  "protected_shell_link_visibility_changed",
  "runtime_config_behavior_changed",
  "runtime_public_config_values_committed",
  "actual_supabase_values_committed",
  "fake_or_placeholder_key_values_committed",
  "env_files_created_or_populated",
  "callback_code_token_session_user_payload_exposed",
  "pkce_code_verifier_printed_logged_or_exposed",
  "implicit_fragment_token_handling_added",
  "manual_storage_session_manipulation_added",
  "durable_auth_session_persistence_added",
  "provider_live_loop_verified",
  "callback_session_recognition_live_verified",
  "protected_shell_admission_live_verified",
  "authenticated_surfaces_born"
]) {
  if (record[flag] !== false) fail(`${recordPath}.${flag} must be false`);
}

if (record.env_example_values_remain_empty !== true) {
  fail("env_example_values_remain_empty must be true");
}
if (
  record.follow_on_blocker_if_any !==
  "pkce_code_verifier_not_persisted_across_oauth_redirect_under_non_persistent_client_boundary"
) {
  fail("follow_on_blocker_if_any mismatch");
}

assertIncludesAll(
  record.docs_and_package_behavior_evidence?.evidence_summary || [],
  [
    "The PKCE exchange sends both the callback auth code and locally stored code verifier.",
    "When persistSession is false, the package constructor uses memory storage instead of browser localStorage or a supplied durable storage adapter."
  ],
  "docs_and_package_behavior_evidence.evidence_summary"
);

const callbackContract = record.callback_contract_preserved || {};
if (callbackContract.session_exchange_method !== "exchangeCodeForSession(code)") {
  fail("callback contract must preserve exchangeCodeForSession(code)");
}
if (callbackContract.failure_state_exposes_sensitive_data !== false) {
  fail("callback failure state must not expose sensitive data");
}
if (callbackContract.implicit_fragment_token_parsing !== false) {
  fail("callback contract must not add implicit fragment parsing");
}

const linkDiagnostic = record.protected_shell_link_visibility_diagnostic || {};
if (linkDiagnostic.callback_entry_link_hidden_unless_session_present !== true) {
  fail("callback entry link must remain hidden unless session_present is true");
}
if (linkDiagnostic.defect_found !== false) fail("protected-shell link defect must remain false");

const sourceTruth = record.source_truth_after_this_pass || {};
for (const flag of [
  "provider_login_initiation_verified",
  "github_oauth_provider_reached",
  "deployed_app_callback_reached"
]) {
  if (sourceTruth[flag] !== true) fail(`source_truth_after_this_pass.${flag} must be true`);
}
for (const flag of [
  "callback_session_recognition_verified",
  "protected_shell_admission_verified",
  "authenticated_surfaces_born",
  "runtime_config_behavior_changed"
]) {
  if (sourceTruth[flag] !== false) fail(`source_truth_after_this_pass.${flag} must be false`);
}

await assertClientBoundary(clientText);
assertLoginBoundary(loginText);
assertCallbackExchangeBoundary(preconditionText);
assertCallbackUiBoundary(callbackText, callbackPageText);
await assertRuntimeConfigOrder();
await assertMissing(forbiddenEnvFiles, "env file");
await assertEnvExampleEmpty();

for (const filePath of [
  recordPath,
  clientPath,
  loginPath,
  preconditionPath,
  callbackScriptPath,
  callbackPagePath,
  loginPagePath,
  protectedShellPagePath
]) {
  assertNoForbiddenValues(filePath, await readText(filePath));
}

console.log("direct ui membrane Supabase callback exchange diagnostics ok (blocker recorded, no birth)");
