import fs from "node:fs/promises";

const recordPath = "data/direct-ui-membrane-conditional-supabase-client-initialization.v0.json";
const clientPath = "js/supabase-client.js";
const envExamplePath = ".env.example";

const runtimePublicConfigGlobal = "AETHERUS_SUPABASE_PUBLIC_CONFIG";
const exactModuleUrl = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.103.2/+esm";
const exactVersionPin = "2.103.2";

const requiredTrueFlags = [
  "implementation_performed",
  "browser_esm_dependency_represented",
  "version_pinned_esm_import_or_loader_represented",
  "supabase_client_initialization_path_exists",
  "supabase_client_initializes_only_when_public_config_present"
];

const requiredFalseFlags = [
  "supabase_dependency_installed",
  "package_installation_performed",
  "runtime_public_config_values_committed",
  "auth_implemented",
  "login_ui_implemented",
  "signup_ui_implemented",
  "credential_capture_implemented",
  "auth_callback_implemented",
  "session_detection_implemented",
  "protected_routes_implemented",
  "protected_shell_entry_implemented",
  "authenticated_surfaces_born",
  "backend_implemented",
  "database_schema_implemented",
  "database_access_implemented",
  "persistence_implemented",
  "rls_implemented",
  "tenant_isolation_implemented",
  "customer_workspace_implemented",
  "billing_implemented",
  "palisade_implemented",
  "weave_runtime_implemented",
  "public_nexus_runtime_implemented"
];

const acceptedPublicConfigNames = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY"
];

const forbiddenPackageFiles = [
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock"
];

const forbiddenEnvFiles = [
  ".env",
  ".env.local",
  ".env.production"
];

const forbiddenImplementedClientPatterns = [
  { label: "Supabase auth access", pattern: /\bsupabase\.auth\b/ },
  { label: "Supabase database access", pattern: /\bsupabase\.from\b/ },
  { label: "sign-in flow", pattern: /\bsignIn\b/ },
  { label: "sign-up flow", pattern: /\bsignUp\b/ },
  { label: "local persistence", pattern: /\blocalStorage\b/ },
  { label: "session persistence", pattern: /\bsessionStorage\b/ },
  { label: "cookie persistence", pattern: /\bdocument\.cookie\b/ }
];

const activeRuntimeFiles = [
  "index.html",
  "membrane.html",
  "workspace.html",
  "auth-boundary.html",
  "js/app.js",
  "js/docs.js",
  "js/pipeline.js",
  "js/preview-workspace.js",
  "js/governance-engine.js",
  "js/trace-viewer.js"
];

const serverSecretTerms = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "service_role",
  "jwt_secret"
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

function assertFlagValues(record) {
  for (const flag of requiredTrueFlags) {
    if (record[flag] !== true) fail(`${recordPath}.${flag} must be true`);
  }
  for (const flag of requiredFalseFlags) {
    if (record[flag] !== false) fail(`${recordPath}.${flag} must be false`);
  }
}

function assertVersionPinnedEsm(clientText) {
  if (!clientText.includes(exactModuleUrl)) fail(`${clientPath} must include the exact module URL`);
  if (clientText.includes("@latest")) fail(`${clientPath} must not use @latest`);
  if (/@supabase\/supabase-js@2(?:[/"'`?]|$)/.test(clientText)) {
    fail(`${clientPath} must not use a major-only @2 Supabase module specifier`);
  }
  if (/(?:https:\/\/cdn\.jsdelivr\.net\/npm\/)?@supabase\/supabase-js(?:[/"'`?]|\+esm|$)/.test(clientText)) {
    fail(`${clientPath} must not use an unversioned Supabase module specifier`);
  }

  const moduleReferences = clientText.match(/@supabase\/supabase-js@[0-9]+\.[0-9]+\.[0-9]+\/\+esm/g) || [];
  if (moduleReferences.length !== 1) fail(`${clientPath} must have one exact version-pinned module reference`);
  if (moduleReferences[0] !== `@supabase/supabase-js@${exactVersionPin}/+esm`) {
    fail(`${clientPath} module reference must pin ${exactVersionPin}`);
  }
}

function assertRuntimeConfigBoundary(clientText) {
  if (!clientText.includes(runtimePublicConfigGlobal)) {
    fail(`${clientPath} must represent ${runtimePublicConfigGlobal}`);
  }
  for (const name of acceptedPublicConfigNames) {
    if (!clientText.includes(name)) fail(`${clientPath} must represent ${name}`);
  }
  if (!/if \(!resolvedUrl\) missing\.push\("SUPABASE_URL"\)/.test(clientText)) {
    fail(`${clientPath} must require SUPABASE_URL before initialization`);
  }
  if (clientText.indexOf("SUPABASE_PUBLISHABLE_KEY") > clientText.indexOf("SUPABASE_ANON_KEY")) {
    fail("SUPABASE_PUBLISHABLE_KEY must be preferred before SUPABASE_ANON_KEY");
  }
}

function assertBoundedCreateClient(clientText) {
  if (!clientText.includes("initializeSupabaseBrowserClient")) {
    fail(`${clientPath} must expose initializeSupabaseBrowserClient`);
  }
  if (!/supabaseModule\.createClient\s*\(/.test(clientText)) {
    fail(`${clientPath} must call createClient only through the loaded module`);
  }
  if (/\bsupabase\.createClient\b/.test(clientText)) {
    fail(`${clientPath} must not use a global supabase.createClient surface`);
  }
  if (!clientText.includes("missing_public_config") || !clientText.includes("absent_config")) {
    fail(`${clientPath} must return a bounded absent_config state`);
  }
  if (!clientText.includes("persistSession: false")) {
    fail(`${clientPath} must explicitly disable client auth persistence`);
  }
  if (!clientText.includes('flowType: "pkce"')) {
    fail(`${clientPath} must explicitly align OAuth to PKCE/code flow`);
  }
  if (!clientText.includes("detectSessionInUrl: false")) {
    fail(`${clientPath} must explicitly disable callback/session URL detection`);
  }
}

function assertNoImplementedForbiddenBehavior(clientText) {
  for (const { label, pattern } of forbiddenImplementedClientPatterns) {
    if (pattern.test(clientText)) fail(`${clientPath} contains forbidden ${label}`);
  }
  for (const term of serverSecretTerms) {
    if (clientText.includes(term)) fail(`${clientPath} must not contain ${term}`);
  }
}

async function assertEnvExampleEmptyNamesOnly() {
  if (!(await exists(envExamplePath))) return;
  const text = await readText(envExamplePath);
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  for (const line of lines) {
    if (!line.includes("=")) fail(".env.example lines must be assignments");
    const [name, ...rest] = line.split("=");
    const value = rest.join("=");
    if (!name.startsWith("SUPABASE_")) fail(`.env.example contains disallowed name ${name}`);
    if (value !== "") fail(`.env.example ${name} must have an empty value`);
  }
}

async function assertServerSecretsBoundedAwayFromRuntimeFiles() {
  for (const filePath of activeRuntimeFiles) {
    if (!(await exists(filePath))) continue;
    const text = await readText(filePath);
    for (const term of serverSecretTerms) {
      if (text.includes(term)) fail(`${filePath} must not contain ${term}`);
    }
  }
}

if (!(await exists(recordPath))) fail(`${recordPath} is missing`);
if (!(await exists(clientPath))) fail(`${clientPath} is missing`);

const record = await readJson(recordPath);
const clientText = await readText(clientPath);

if (record.schema_version !== "0.1") fail("schema_version must be 0.1");
if (
  record.generated_for_sub_pass !==
  "§1.2 Supabase Implementation 0.3 — Conditional Live Client Initialization"
) {
  fail("generated_for_sub_pass mismatch");
}
if (record.baseline_commit !== "19a27669d184b997dd2ffcf18832182c317a60eb") {
  fail("baseline_commit mismatch");
}
if (record.object_status !== "conditional_supabase_browser_client_initialization") {
  fail("object_status mismatch");
}

assertFlagValues(record);
if (record.browser_esm_module_url !== exactModuleUrl) fail("browser_esm_module_url mismatch");
if (record.browser_esm_version_pin !== exactVersionPin) fail("browser_esm_version_pin mismatch");
if (record.runtime_public_config_global !== runtimePublicConfigGlobal) {
  fail("runtime_public_config_global mismatch");
}
if (record.oauth_flow_type !== "pkce") fail("oauth_flow_type must be pkce");
if (record.automatic_url_session_detection !== false) {
  fail("automatic_url_session_detection must remain false");
}
if (record.durable_auth_session_persistence_added !== false) {
  fail("durable_auth_session_persistence_added must remain false");
}
assertIncludesAll(record.accepted_public_config_names || [], acceptedPublicConfigNames, "accepted_public_config_names");
if (record.preferred_public_key_name !== "SUPABASE_PUBLISHABLE_KEY") {
  fail("preferred public key must be SUPABASE_PUBLISHABLE_KEY");
}
if (record.fallback_public_key_name !== "SUPABASE_ANON_KEY") {
  fail("fallback public key must be SUPABASE_ANON_KEY");
}
assertIncludesAll(record.claimable_after_this_pass || [], [
  "A conditional Supabase browser-client initialization path exists using the selected static ESM/runtime-public-config strategy; it initializes only when externally supplied browser-safe runtime public config is present."
], "claimable_after_this_pass");
assertIncludesAll(record.not_claimable_after_this_pass || [], [
  "login exists",
  "signup exists",
  "credential capture exists",
  "auth callback exists",
  "session detection exists",
  "protected route exists",
  "authenticated shell exists",
  "backend exists",
  "database exists",
  "persistence exists",
  "RLS exists",
  "tenant isolation exists",
  "customer workspace exists",
  "billing exists",
  "production SaaS exists"
], "not_claimable_after_this_pass");
assertIncludesAll(record.hard_boundaries_preserved || [], [
  "No package installation or package files are introduced.",
  "No Supabase runtime public config values are committed.",
  "No runtime config file with values is committed."
], "hard_boundaries_preserved");

assertRuntimeConfigBoundary(clientText);
assertVersionPinnedEsm(clientText);
assertBoundedCreateClient(clientText);
assertNoImplementedForbiddenBehavior(clientText);
await assertMissing(forbiddenPackageFiles, "package/dependency file");
await assertMissing(forbiddenEnvFiles, "env file");
await assertEnvExampleEmptyNamesOnly();
await assertServerSecretsBoundedAwayFromRuntimeFiles();

console.log("direct ui membrane conditional Supabase client initialization ok");
