import fs from "node:fs/promises";

const recordPath = "data/direct-ui-membrane-auth-callback-session-guard-precondition.v0.json";
const utilityPath = "js/supabase-auth-precondition.js";
const callbackRoutePath = "auth-callback.html";
const callbackScriptPath = "js/supabase-auth-callback.js";
const protectedShellBirthGatePath = "data/direct-ui-membrane-protected-shell-birth-gate.v0.json";
const envExamplePath = ".env.example";

const requiredTrueFlags = [
  "implementation_performed",
  "conditional_supabase_client_initialization_required",
  "auth_callback_precondition_implemented",
  "session_guard_precondition_implemented",
  "credential_flow_handling_started",
  "auth_callback_utility_implemented",
  "session_detection_implemented"
];

const requiredFalseFlags = [
  "credential_capture_implemented",
  "login_ui_implemented",
  "signup_ui_implemented",
  "provider_login_initiation_implemented",
  "protected_route_implemented",
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

const activeProductFiles = [
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

const forbiddenBehaviorPatterns = [
  { label: "provider login initiation", pattern: /\bsignInWithOAuth\b/ },
  { label: "password login initiation", pattern: /\bsignInWithPassword\b/ },
  { label: "signup initiation", pattern: /\bsignUp\b/ },
  { label: "database access", pattern: /\bsupabase\.from\b/ },
  { label: "local persistence", pattern: /\blocalStorage\b/ },
  { label: "session persistence", pattern: /\bsessionStorage\b/ },
  { label: "cookie persistence", pattern: /\bdocument\.cookie\b/ },
  { label: "credential form", pattern: /<form\b/i },
  { label: "credential field", pattern: /<input\b[^>]*(?:email|password)/i },
  { label: "authenticated dashboard", pattern: /\bauthenticated dashboard\b/i },
  { label: "account settings", pattern: /\baccount settings\b/i },
  { label: "billing page", pattern: /\bbilling page\b/i },
  { label: "team surface", pattern: /\bteam surface\b/i }
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

function assertRecordFlags(record) {
  for (const flag of requiredTrueFlags) {
    if (record[flag] !== true) fail(`${recordPath}.${flag} must be true`);
  }
  for (const flag of requiredFalseFlags) {
    if (record[flag] !== false) fail(`${recordPath}.${flag} must be false`);
  }
}

function assertUtilityBounded(text) {
  if (!text.includes("initializeSupabaseBrowserClient")) {
    fail(`${utilityPath} must reuse the conditional Supabase client initializer`);
  }
  if (!text.includes("exchangeCodeForSession")) {
    fail(`${utilityPath} must include bounded callback exchange handling`);
  }
  if (!text.includes("getSession")) {
    fail(`${utilityPath} must include bounded session guard classification`);
  }
  if (!/clientResult\.client\.auth\.exchangeCodeForSession\(code\)/.test(text)) {
    fail("exchangeCodeForSession must be called only with the extracted callback code");
  }
  if (!/clientResult\.client\.auth\.getSession\(\)/.test(text)) {
    fail("getSession must be called only by the session guard classifier");
  }
  for (const state of [
    "absent_config",
    "no_callback_code",
    "callback_exchange_attempted",
    "callback_exchange_failed",
    "session_absent",
    "guard_permitted_without_shell_entry"
  ]) {
    if (!text.includes(state)) fail(`${utilityPath} must represent ${state}`);
  }
  if (!text.includes("protected_shell_entry_implemented: false")) {
    fail(`${utilityPath} must export protected shell non-birth metadata`);
  }
  if (!text.includes("authenticated_surfaces_born: false")) {
    fail(`${utilityPath} must export authenticated surfaces non-birth metadata`);
  }
}

function assertNoForbiddenBehavior(filePath, text) {
  for (const { label, pattern } of forbiddenBehaviorPatterns) {
    if (pattern.test(text)) fail(`${filePath} contains forbidden ${label}`);
  }
}

async function assertCallbackRouteBounded(record) {
  const routeExists = await exists(callbackRoutePath);
  if (record.auth_callback_route_implemented !== routeExists) {
    const birthGateExists = await exists(protectedShellBirthGatePath);
    if (!birthGateExists || !routeExists || record.auth_callback_route_implemented !== false) {
      fail("auth_callback_route_implemented must match callback route file existence unless the later protected-shell birth gate owns the route");
    }
    const birthGate = await readJson(protectedShellBirthGatePath);
    if (birthGate.auth_callback_route_implemented !== true) {
      fail("protected-shell birth gate must own the implemented callback route");
    }
  }
  if (!routeExists) {
    if (await exists(callbackScriptPath)) fail(`${callbackScriptPath} must not exist without ${callbackRoutePath}`);
    return;
  }

  const routeText = await readText(callbackRoutePath);
  assertNoForbiddenBehavior(callbackRoutePath, routeText);
  for (const required of ["callback", "session", "precondition"]) {
    if (!routeText.toLowerCase().includes(required)) fail(`${callbackRoutePath} must remain callback-precondition bounded`);
  }
  if (await exists(callbackScriptPath)) {
    const scriptText = await readText(callbackScriptPath);
    assertNoForbiddenBehavior(callbackScriptPath, scriptText);
    if (!scriptText.includes("handleSupabaseAuthCallbackPrecondition")) {
      fail(`${callbackScriptPath} must call only the bounded callback handler`);
    }
  }
}

async function assertActiveProductFilesClean() {
  for (const filePath of activeProductFiles) {
    if (!(await exists(filePath))) continue;
    const text = await readText(filePath);
    if (text.includes("exchangeCodeForSession")) fail(`${filePath} must not perform callback exchange`);
    if (text.includes("getSession")) fail(`${filePath} must not perform session guard classification`);
    if (text.includes("supabase.auth")) fail(`${filePath} must not use Supabase auth`);
    assertNoForbiddenBehavior(filePath, text);
    for (const term of serverSecretTerms) {
      if (text.includes(term)) fail(`${filePath} must not contain ${term}`);
    }
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

if (!(await exists(recordPath))) fail(`${recordPath} is missing`);
if (!(await exists(utilityPath))) fail(`${utilityPath} is missing`);

const record = await readJson(recordPath);
const utilityText = await readText(utilityPath);

if (record.schema_version !== "0.1") fail("schema_version must be 0.1");
if (
  record.generated_for_sub_pass !==
  "§1.2 Supabase Implementation 0.4 — Auth Callback and Session Guard Precondition"
) {
  fail("generated_for_sub_pass mismatch");
}
if (record.baseline_commit !== "57ebe65ed4dd82faa5ea9cb2c7a5b8ebdecab25e") {
  fail("baseline_commit mismatch");
}
if (record.object_status !== "auth_callback_session_guard_precondition") {
  fail("object_status mismatch");
}

assertRecordFlags(record);
if (record.auth_callback_route_implemented !== false) {
  fail("auth_callback_route_implemented must be false when no callback route is created");
}
assertIncludesAll(record.permitted_supabase_auth_methods || [], [
  "exchangeCodeForSession",
  "getSession"
], "permitted_supabase_auth_methods");
assertIncludesAll(record.claimable_after_this_pass || [], [
  "A bounded Supabase auth callback/session-guard precondition exists; the repo can classify provider-return/session state when externally supplied public config and callback input exist."
], "claimable_after_this_pass");
assertIncludesAll(record.not_claimable_after_this_pass || [], [
  "login exists",
  "signup exists",
  "user can initiate provider login from the product",
  "credential capture exists",
  "protected route exists",
  "protected shell entry exists",
  "authenticated shell exists",
  "authenticated workspace exists",
  "backend exists",
  "database exists",
  "persistence exists",
  "RLS exists",
  "tenant isolation exists",
  "customer workspace exists",
  "billing exists",
  "production SaaS exists"
], "not_claimable_after_this_pass");

assertUtilityBounded(utilityText);
assertNoForbiddenBehavior(utilityPath, utilityText);
for (const term of serverSecretTerms) {
  if (utilityText.includes(term)) fail(`${utilityPath} must not contain ${term}`);
}
await assertCallbackRouteBounded(record);
await assertActiveProductFilesClean();
await assertMissing(forbiddenPackageFiles, "package/dependency file");
await assertMissing(forbiddenEnvFiles, "env file");
await assertEnvExampleEmptyNamesOnly();

console.log("direct ui membrane auth callback session guard precondition ok");
