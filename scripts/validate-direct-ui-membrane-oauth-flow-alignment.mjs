import fs from "node:fs/promises";

const recordPath = "data/direct-ui-membrane-oauth-flow-alignment.v0.json";
const authStorageImplementationPath = "data/direct-ui-membrane-auth-storage-implementation.v0.json";
const clientPath = "js/supabase-client.js";
const loginPath = "js/supabase-login-initiation.js";
const callbackPath = "js/supabase-auth-precondition.js";
const envExamplePath = ".env.example";

const authPages = [
  {
    page: "auth-login.html",
    runtimeScript: "js/aetherus-runtime-config.js",
    authModule: "js/supabase-login-surface.js"
  },
  {
    page: "auth-callback.html",
    runtimeScript: "js/aetherus-runtime-config.js",
    authModule: "js/supabase-auth-callback.js"
  },
  {
    page: "protected-shell.html",
    runtimeScript: "js/aetherus-runtime-config.js",
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
  { label: "GitHub OAuth token-like value", pattern: /\bgh[opsu]_[A-Za-z0-9_]{20,}/ }
];

const forbiddenFragmentHandlingPatterns = [
  /location\.hash/,
  /hash\.substring/,
  /URLSearchParams\(.*hash/s,
  /access_token/,
  /refresh_token/,
  /provider_token/
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

function assertScriptOrder(pageText, page, runtimeScript, authModule) {
  const runtimeIndex = pageText.indexOf(`src="${runtimeScript}"`);
  const moduleIndex = pageText.indexOf(`src="${authModule}"`);
  if (runtimeIndex === -1) fail(`${page} must load ${runtimeScript}`);
  if (moduleIndex === -1) fail(`${page} must load ${authModule}`);
  if (runtimeIndex > moduleIndex) fail(`${page} must load runtime config before auth module`);
}

async function assertAuthPageOrder() {
  for (const { page, runtimeScript, authModule } of authPages) {
    assertScriptOrder(await readText(page), page, runtimeScript, authModule);
  }
}

async function assertPkceClientConfiguration(clientText) {
  if (!clientText.includes('flowType: "pkce"')) {
    fail(`${clientPath} must configure auth.flowType as pkce`);
  }
  if (await exists(authStorageImplementationPath)) {
    const authStorageImplementation = await readJson(authStorageImplementationPath);
    if (authStorageImplementation.bounded_supabase_auth_storage_implemented !== true) {
      fail(`${authStorageImplementationPath}.bounded_supabase_auth_storage_implemented must be true`);
    }
    if (!clientText.includes("persistSession: true")) {
      fail(`${clientPath} must implement the authorized bounded Supabase auth storage boundary`);
    }
  } else if (!clientText.includes("persistSession: false")) {
    fail(`${clientPath} must keep durable auth session persistence disabled before the storage implementation pass`);
  }
  if (!clientText.includes("autoRefreshToken: false")) {
    fail(`${clientPath} must keep autoRefreshToken disabled`);
  }
  if (!clientText.includes("detectSessionInUrl: false")) {
    fail(`${clientPath} must keep automatic URL session detection disabled`);
  }
}

function assertCallbackContract(callbackText) {
  if (!callbackText.includes('params.get("code")')) {
    fail(`${callbackPath} must keep reading callback query parameter code`);
  }
  if (!/clientResult\.client\.auth\.exchangeCodeForSession\(code\)/.test(callbackText)) {
    fail(`${callbackPath} must keep exchangeCodeForSession(code)`);
  }
  for (const pattern of forbiddenFragmentHandlingPatterns) {
    if (pattern.test(callbackText)) fail(`${callbackPath} must not add implicit-token fragment handling`);
  }
}

function assertLoginContract(loginText) {
  if (!/clientResult\.client\.auth\.signInWithOAuth\(\{/.test(loginText)) {
    fail(`${loginPath} must retain bounded signInWithOAuth initiation`);
  }
  if (!loginText.includes("redirectTo: resolveRedirectTo(options.redirectTo)")) {
    fail(`${loginPath} must retain callback redirect target resolution`);
  }
  for (const pattern of forbiddenFragmentHandlingPatterns) {
    if (pattern.test(loginText)) fail(`${loginPath} must not add implicit-token fragment handling`);
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

async function assertNoCommittedValues() {
  for (const filePath of [recordPath, clientPath, loginPath, callbackPath]) {
    const text = await readText(filePath);
    for (const { label, pattern } of forbiddenValuePatterns) {
      if (pattern.test(text)) fail(`${filePath} contains forbidden ${label}`);
    }
  }
}

if (!(await exists(recordPath))) fail(`${recordPath} is missing`);

const record = await readJson(recordPath);
const clientText = await readText(clientPath);
const loginText = await readText(loginPath);
const callbackText = await readText(callbackPath);

if (record.schema_version !== "0.1") fail("schema_version must be 0.1");
if (
  record.generated_for_sub_pass !==
  "§1.2 Supabase OAuth Flow Alignment 0.1 — PKCE Callback Contract"
) {
  fail("generated_for_sub_pass mismatch");
}
if (record.baseline_commit !== "be54f3fe1ec1091627cff6095a57dc08542288d2") {
  fail("baseline_commit mismatch");
}
if (record.object_status !== "supabase_oauth_flow_alignment") {
  fail("object_status mismatch");
}
if (
  record.observed_blocker_being_addressed !==
  "callback_code_absent_because_supabase_returned_access_token_fragment"
) {
  fail("observed blocker mismatch");
}
for (const flag of [
  "implementation_performed",
  "pkce_code_callback_alignment_implemented",
  "supabase_client_flow_configuration_changed",
  "runtime_config_script_order_preserved"
]) {
  if (record[flag] !== true) fail(`${recordPath}.${flag} must be true`);
}
for (const flag of [
  "provider_login_initiation_changed",
  "callback_handler_changed",
  "runtime_config_behavior_changed",
  "implicit_fragment_token_handling_added",
  "manual_storage_session_manipulation_added",
  "durable_auth_session_persistence_added"
]) {
  if (record[flag] !== false) fail(`${recordPath}.${flag} must be false`);
}
if (record.selected_oauth_flow_type !== "pkce") fail("selected_oauth_flow_type must be pkce");
if (record.client_auth_configuration?.flowType !== "pkce") {
  fail("client_auth_configuration.flowType must be pkce");
}
for (const key of ["persistSession", "autoRefreshToken", "detectSessionInUrl"]) {
  if (record.client_auth_configuration?.[key] !== false) {
    fail(`client_auth_configuration.${key} must be false`);
  }
}
if (record.callback_contract_preserved?.session_exchange_method !== "exchangeCodeForSession(code)") {
  fail("callback contract must preserve exchangeCodeForSession(code)");
}
if (record.callback_contract_preserved?.implicit_fragment_token_parsing !== false) {
  fail("callback contract must not add implicit fragment parsing");
}
for (const flag of [
  "provider_live_loop_verified",
  "callback_session_recognition_live_verified",
  "protected_shell_admission_live_verified",
  "authenticated_surfaces_born",
  "runtime_public_config_values_committed",
  "actual_supabase_values_committed",
  "fake_or_placeholder_key_values_committed",
  "env_files_created"
]) {
  if (record.source_truth_after_this_pass?.[flag] !== false) {
    fail(`source_truth_after_this_pass.${flag} must be false`);
  }
}
if (record.source_truth_after_this_pass?.env_example_values_remain_empty !== true) {
  fail("env_example_values_remain_empty must be true");
}
assertIncludesAll(
  record.claimable_after_this_pass || [],
  ["The OAuth flow has been aligned toward the PKCE/code callback contract expected by the existing callback handler."],
  "claimable_after_this_pass"
);
assertIncludesAll(
  record.not_claimable_after_this_pass || [],
  [
    "provider live loop verified",
    "callback session recognition live verified",
    "protected shell admission live verified",
    "Authenticated Surfaces born",
    "implicit fragment token handling exists",
    "durable auth session persistence exists"
  ],
  "not_claimable_after_this_pass"
);

await assertPkceClientConfiguration(clientText);
assertLoginContract(loginText);
assertCallbackContract(callbackText);
await assertAuthPageOrder();
await assertMissing(forbiddenEnvFiles, "env file");
await assertEnvExampleEmpty();
await assertNoCommittedValues();

console.log("direct ui membrane Supabase OAuth flow alignment ok (PKCE/code contract, no birth)");
