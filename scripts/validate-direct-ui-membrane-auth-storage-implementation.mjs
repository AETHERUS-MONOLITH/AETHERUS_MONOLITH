import fs from "node:fs/promises";

const recordPath = "data/direct-ui-membrane-auth-storage-implementation.v0.json";
const decisionPath = "data/direct-ui-membrane-auth-storage-boundary-decision.v0.json";
const clientPath = "js/supabase-client.js";
const loginPath = "js/supabase-login-initiation.js";
const preconditionPath = "js/supabase-auth-precondition.js";
const callbackScriptPath = "js/supabase-auth-callback.js";
const protectedShellScriptPath = "js/supabase-protected-shell.js";
const envExamplePath = ".env.example";
const runtimeConfigArtifactPath = "js/aetherus-runtime-config.js";

const authPages = [
  {
    page: "auth-login.html",
    runtimeScript: runtimeConfigArtifactPath,
    authModule: "js/supabase-login-surface.js"
  },
  {
    page: "auth-callback.html",
    runtimeScript: runtimeConfigArtifactPath,
    authModule: callbackScriptPath
  },
  {
    page: "protected-shell.html",
    runtimeScript: runtimeConfigArtifactPath,
    authModule: "js/supabase-protected-shell.js"
  }
];

const forbiddenEnvFiles = [
  ".env",
  ".env.local",
  ".env.production"
];

const forbiddenValuePatterns = [
  { label: "Supabase project URL", pattern: /https:\/\/[A-Za-z0-9-]+\.supabase\.co/i },
  { label: "Supabase key-like value", pattern: /\bsb_(?:publishable|anon|secret|service)_[A-Za-z0-9_-]{8,}/i },
  { label: "JWT-like token", pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
  { label: "OAuth token-like value", pattern: /\bgh[opsu]_[A-Za-z0-9_]{20,}/i }
];

const forbiddenRuntimePatterns = [
  { label: "manual localStorage manipulation", pattern: /localStorage\.(?:setItem|getItem|removeItem)/ },
  { label: "manual sessionStorage manipulation", pattern: /sessionStorage\.(?:setItem|getItem|removeItem)/ },
  { label: "cookie persistence", pattern: /document\.cookie/ },
  { label: "manual setSession shortcut", pattern: /\.auth\.setSession\(/ },
  { label: "implicit fragment token handling", pattern: /location\.hash|provider_token|access_token|refresh_token/ },
  { label: "database access", pattern: /\bsupabase\.from\b|\.from\s*\(/ },
  { label: "sensitive auth logging", pattern: /console\.(?:log|debug|info|warn|error)\([^)]*(?:code|token|session|user|verifier)/is }
];

const mustRemainFalse = [
  "provider_live_loop_verified",
  "callback_session_recognition_live_verified",
  "protected_shell_admission_live_verified",
  "authenticated_surfaces_born",
  "manual_local_storage_or_session_storage_manipulation_added",
  "manual_token_or_session_handling_added",
  "custom_storage_adapter_added",
  "implicit_fragment_token_handling_added",
  "callback_handler_changed",
  "provider_login_initiation_changed",
  "protected_shell_behavior_changed",
  "runtime_public_config_values_committed",
  "actual_supabase_values_committed",
  "fake_or_placeholder_key_values_committed",
  "env_files_created_or_populated",
  "callback_code_token_session_user_payload_exposed",
  "pkce_code_verifier_printed_logged_or_exposed",
  "application_data_persistence_implemented",
  "backend_implemented",
  "database_schema_implemented",
  "database_access_implemented",
  "rls_implemented",
  "tenant_isolation_implemented",
  "customer_workspace_implemented",
  "billing_implemented",
  "palisade_implemented",
  "weave_runtime_implemented",
  "public_nexus_runtime_implemented"
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

async function assertMissing(paths, label) {
  for (const filePath of paths) {
    if (await exists(filePath)) fail(`${label}: ${filePath} must not exist`);
  }
}

function assertNoForbiddenValues(filePath, text) {
  for (const { label, pattern } of forbiddenValuePatterns) {
    if (pattern.test(text)) fail(`${filePath} contains forbidden ${label}`);
  }
}

function assertNoForbiddenRuntime(filePath, text) {
  for (const { label, pattern } of forbiddenRuntimePatterns) {
    if (pattern.test(text)) fail(`${filePath} contains forbidden ${label}`);
  }
}

function assertScriptOrder(html, page, runtimeScript, authModule) {
  const runtimeIndex = html.indexOf(`src="${runtimeScript}"`);
  const moduleIndex = html.indexOf(`src="${authModule}"`);
  if (runtimeIndex === -1) fail(`${page} must load ${runtimeScript}`);
  if (moduleIndex === -1) fail(`${page} must load ${authModule}`);
  if (runtimeIndex > moduleIndex) fail(`${page} must load runtime config before auth module`);
}

async function assertAuthPageOrder() {
  for (const { page, runtimeScript, authModule } of authPages) {
    assertScriptOrder(await readText(page), page, runtimeScript, authModule);
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

function assertClientConfiguration(clientText) {
  if (!clientText.includes('flowType: "pkce"')) fail(`${clientPath} must keep flowType pkce`);
  if (!clientText.includes("persistSession: true")) {
    fail(`${clientPath} must implement bounded Supabase auth storage with persistSession true`);
  }
  if (!clientText.includes("autoRefreshToken: false")) {
    fail(`${clientPath} must keep autoRefreshToken false`);
  }
  if (!clientText.includes("detectSessionInUrl: false")) {
    fail(`${clientPath} must keep detectSessionInUrl false`);
  }
  if (clientText.includes("storage:")) {
    fail(`${clientPath} must not add a custom storage adapter`);
  }
}

function assertAuthContracts(loginText, preconditionText, callbackText, protectedShellText) {
  if (!/clientResult\.client\.auth\.signInWithOAuth\(\{/.test(loginText)) {
    fail(`${loginPath} must retain bounded signInWithOAuth initiation`);
  }
  if (!/clientResult\.client\.auth\.exchangeCodeForSession\(code\)/.test(preconditionText)) {
    fail(`${preconditionPath} must retain exchangeCodeForSession(code)`);
  }
  if (!/clientResult\.client\.auth\.getSession\(\)/.test(preconditionText)) {
    fail(`${preconditionPath} must retain getSession guard classification`);
  }
  if (!callbackText.includes("session_present === true")) {
    fail(`${callbackScriptPath} must reveal shell entry only after session recognition`);
  }
  if (!protectedShellText.includes("guard_denied === false")) {
    fail(`${protectedShellScriptPath} must admit only when the guard permits`);
  }
  if (!protectedShellText.includes("session_present === true")) {
    fail(`${protectedShellScriptPath} must require session_present`);
  }
}

if (!(await exists(recordPath))) fail(`${recordPath} is missing`);
if (!(await exists(decisionPath))) fail(`${decisionPath} is missing`);

const record = await readJson(recordPath);
const decision = await readJson(decisionPath);
const clientText = await readText(clientPath);
const loginText = await readText(loginPath);
const preconditionText = await readText(preconditionPath);
const callbackText = await readText(callbackScriptPath);
const protectedShellText = await readText(protectedShellScriptPath);

if (record.schema_version !== "0.1") fail("schema_version must be 0.1");
if (
  record.generated_for_sub_pass !==
  "§1.2 Supabase Auth Storage Implementation 0.1 — Bounded PKCE/Auth Session Continuity"
) {
  fail("generated_for_sub_pass mismatch");
}
if (record.baseline_commit !== "ffa80c91ab170dd3436f0f0e96c7fb0728639e1e") {
  fail("baseline_commit mismatch");
}
if (record.object_status !== "supabase_auth_storage_implementation") {
  fail("object_status mismatch");
}
if (record.active_blocker_being_addressed !== "pkce_code_verifier_not_persisted_across_oauth_redirect_under_non_persistent_client_boundary") {
  fail("active blocker mismatch");
}
for (const flag of [
  "implementation_performed",
  "bounded_supabase_auth_storage_implemented",
  "runtime_auth_storage_change_implemented",
  "supabase_client_initialization_behavior_changed",
  "runtime_config_script_order_preserved"
]) {
  if (record[flag] !== true) fail(`${recordPath}.${flag} must be true`);
}
if (record.runtime_config_behavior_changed !== false) {
  fail("runtime_config_behavior_changed must be false");
}
for (const flag of mustRemainFalse) {
  if (record[flag] !== false) fail(`${recordPath}.${flag} must be false`);
}
if (record.env_example_values_remain_empty !== true) {
  fail("env_example_values_remain_empty must be true");
}
if (decision.decision_classification !== "supabase_auth_session_storage_permitted_bounded") {
  fail("decision record must permit bounded Supabase auth session storage");
}

const config = record.runtime_client_configuration_after_this_pass || {};
if (config.path !== clientPath) fail("runtime client path mismatch");
if (config.flowType !== "pkce") fail("runtime flowType must be pkce");
if (config.persistSession !== true) fail("runtime persistSession must be true");
if (config.autoRefreshToken !== false) fail("runtime autoRefreshToken must be false");
if (config.detectSessionInUrl !== false) fail("runtime detectSessionInUrl must be false");
if (config.storage !== "default_supabase_browser_storage") {
  fail("runtime storage must be default Supabase browser storage");
}
for (const key of ["custom_storage_adapter", "manual_storage_manipulation", "manual_token_handling"]) {
  if (config[key] !== false) fail(`runtime config ${key} must be false`);
}

assertIncludesAll(
  record.allowed_purpose || [],
  [
    "PKCE code verifier continuity across provider redirect",
    "Supabase auth session recognition after exchangeCodeForSession(code)",
    "protected-shell session guard evaluation through Supabase auth APIs"
  ],
  "allowed_purpose"
);
assertIncludesAll(
  record.not_claimable_after_this_pass || [],
  [
    "provider live loop verified",
    "callback session recognition live verified",
    "protected shell admission live verified",
    "Authenticated Surfaces born",
    "application data persistence exists"
  ],
  "not_claimable_after_this_pass"
);
if (record.follow_on_blocker_if_any !== "live_callback_session_recognition_and_protected_shell_admission_not_verified") {
  fail("follow_on_blocker_if_any mismatch");
}

assertClientConfiguration(clientText);
assertAuthContracts(loginText, preconditionText, callbackText, protectedShellText);
await assertAuthPageOrder();
await assertMissing(forbiddenEnvFiles, "env file");
await assertEnvExampleEmpty();

for (const filePath of [
  recordPath,
  decisionPath,
  clientPath,
  loginPath,
  preconditionPath,
  callbackScriptPath,
  protectedShellScriptPath,
  "auth-login.html",
  "auth-callback.html",
  "protected-shell.html"
]) {
  const text = await readText(filePath);
  assertNoForbiddenValues(filePath, text);
  if (!filePath.startsWith("data/")) assertNoForbiddenRuntime(filePath, text);
}

console.log("direct ui membrane Supabase auth storage implementation ok (bounded continuity only)");
