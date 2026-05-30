import fs from "node:fs/promises";

const recordPath = "data/direct-ui-membrane-provider-login-initiation.v0.json";
const utilityPath = "js/supabase-login-initiation.js";
const surfacePath = "auth-login.html";
const surfaceScriptPath = "js/supabase-login-surface.js";
const callbackUtilityPath = "js/supabase-auth-precondition.js";
const envExamplePath = ".env.example";

const requiredTrueFlags = [
  "implementation_performed",
  "conditional_supabase_client_initialization_required",
  "auth_callback_precondition_required",
  "provider_login_initiation_implemented",
  "provider_login_surface_implemented",
  "credential_flow_handling_started",
  "auth_callback_precondition_implemented",
  "session_guard_precondition_implemented",
  "session_detection_implemented"
];

const requiredFalseFlags = [
  "credential_capture_implemented",
  "password_login_implemented",
  "signup_ui_implemented",
  "sign_up_implemented",
  "email_password_form_implemented",
  "protected_route_implemented",
  "protected_shell_entry_implemented",
  "authenticated_surfaces_born",
  "authenticated_workspace_implemented",
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

const implementationFiles = [
  utilityPath,
  surfacePath,
  surfaceScriptPath,
  callbackUtilityPath,
  "js/supabase-client.js"
];

const serverSecretTerms = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "service_role",
  "jwt_secret"
];

const protectedSurfacePatterns = [
  /\bauthenticated dashboard\b/i,
  /\bprotected shell\b/i,
  /\bprotected workspace\b/i,
  /\baccount settings\b/i,
  /\bbilling page\b/i,
  /\bteam surface\b/i,
  /\btenant selector\b/i
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

function assertNoCredentialCapture(filePath, text) {
  if (/<form\b/i.test(text)) fail(`${filePath} must not contain a form`);
  if (/<input\b/i.test(text)) fail(`${filePath} must not contain input controls`);
  if (/<input\b[^>]*type=["']?password["']?/i.test(text)) {
    fail(`${filePath} must not contain input type=password`);
  }
  if (/\bsignInWithPassword\b/.test(text)) fail(`${filePath} must not implement password login`);
  if (/\bsignUp\b/.test(text)) fail(`${filePath} must not implement signup`);
}

function assertNoForbiddenRuntime(filePath, text) {
  if (/\bsupabase\.from\b/.test(text)) fail(`${filePath} must not access database APIs`);
  if (/\blocalStorage\b/.test(text)) fail(`${filePath} must not use localStorage`);
  if (/\bsessionStorage\b/.test(text)) fail(`${filePath} must not use sessionStorage`);
  if (/\bdocument\.cookie\b/.test(text)) fail(`${filePath} must not use document.cookie`);
  for (const term of serverSecretTerms) {
    if (text.includes(term)) fail(`${filePath} must not contain ${term}`);
  }
}

function assertNoProtectedSurface(filePath, text) {
  for (const pattern of protectedSurfacePatterns) {
    if (pattern.test(text)) fail(`${filePath} must not create protected shell/workspace surfaces`);
  }
}

function assertLoginUtilityBounded(text) {
  if (!text.includes("initializeSupabaseBrowserClient")) {
    fail(`${utilityPath} must reuse the conditional Supabase client initializer`);
  }
  if (!text.includes('const SUPABASE_LOGIN_PROVIDER = "github"')) {
    fail(`${utilityPath} must select github explicitly`);
  }
  if (!/clientResult\.client\.auth\.signInWithOAuth\(\{/.test(text)) {
    fail("signInWithOAuth must appear only as bounded provider initiation");
  }
  if (!text.includes("unsupported_provider")) fail("unsupported_provider state missing");
  if (!text.includes("absent_config")) fail("absent_config state missing");
  if (!text.includes("provider_login_initiation_attempted")) {
    fail("provider_login_initiation_attempted state missing");
  }
  if (!text.includes("provider_login_initiation_failed")) {
    fail("provider_login_initiation_failed state missing");
  }
  if (!text.includes("provider_login_initiation_unavailable")) {
    fail("provider_login_initiation_unavailable state missing");
  }
  if (!text.includes("credential_capture_implemented: false")) {
    fail(`${utilityPath} must export credential capture non-birth metadata`);
  }
  if (!text.includes("protected_shell_entry_implemented: false")) {
    fail(`${utilityPath} must export protected shell non-birth metadata`);
  }
}

function assertSurfaceBounded(text) {
  if (!text.includes("Continue with GitHub")) fail(`${surfacePath} must expose the provider action`);
  if (!text.includes("data-login-provider")) fail(`${surfacePath} must wire a bounded provider action`);
  if (!text.includes("not create an authenticated")) {
    fail(`${surfacePath} must explicitly avoid authenticated workspace claims`);
  }
  if (text.includes("Create account")) fail(`${surfacePath} must not include account creation copy`);
}

async function assertAuthMethodPlacement() {
  const utilityText = await readText(utilityPath);
  const callbackText = await readText(callbackUtilityPath);
  const surfaceText = await readText(surfacePath);
  const surfaceScriptText = await readText(surfaceScriptPath);

  assertLoginUtilityBounded(utilityText);
  assertSurfaceBounded(surfaceText);

  const files = new Map([
    [utilityPath, utilityText],
    [callbackUtilityPath, callbackText],
    [surfacePath, surfaceText],
    [surfaceScriptPath, surfaceScriptText]
  ]);

  for (const [filePath, text] of files) {
    assertNoCredentialCapture(filePath, text);
    assertNoForbiddenRuntime(filePath, text);
    assertNoProtectedSurface(filePath, text);
  }

  if (callbackText.includes("signInWithOAuth")) {
    fail(`${callbackUtilityPath} must not initiate provider login`);
  }
  if (surfaceScriptText.includes("signInWithOAuth")) {
    fail(`${surfaceScriptPath} must call the bounded utility, not Supabase auth directly`);
  }
  if (!callbackText.includes("exchangeCodeForSession")) {
    fail(`${callbackUtilityPath} must retain bounded callback handling`);
  }
  if (!callbackText.includes("getSession")) {
    fail(`${callbackUtilityPath} must retain bounded session guard classification`);
  }
  if (utilityText.includes("exchangeCodeForSession") || utilityText.includes("getSession")) {
    fail(`${utilityPath} must not perform callback exchange or session guard classification`);
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
for (const filePath of [utilityPath, surfacePath, surfaceScriptPath, callbackUtilityPath]) {
  if (!(await exists(filePath))) fail(`${filePath} is missing`);
}

const record = await readJson(recordPath);

if (record.schema_version !== "0.1") fail("schema_version must be 0.1");
if (
  record.generated_for_sub_pass !==
  "§1.2 Supabase Implementation 0.5 — Provider Login Initiation Surface"
) {
  fail("generated_for_sub_pass mismatch");
}
if (record.baseline_commit !== "0972922e5e1dc546df11aa01af0f2f6d08d9cd39") {
  fail("baseline_commit mismatch");
}
if (record.object_status !== "provider_login_initiation_surface") {
  fail("object_status mismatch");
}

assertRecordFlags(record);
if (record.selected_provider !== "github") fail("selected_provider must be github");
if (
  record.credential_flow_handling_scope !==
  "provider_login_initiation_plus_callback_session_precondition"
) {
  fail("credential_flow_handling_scope mismatch");
}
assertIncludesAll(record.permitted_supabase_auth_methods || [], [
  "signInWithOAuth",
  "exchangeCodeForSession",
  "getSession"
], "permitted_supabase_auth_methods");
assertIncludesAll(record.claimable_after_this_pass || [], [
  "A bounded provider login initiation surface exists; the repo can initiate a Supabase OAuth provider flow when externally supplied public config is present."
], "claimable_after_this_pass");
assertIncludesAll(record.not_claimable_after_this_pass || [], [
  "password login exists",
  "signup exists",
  "credential capture exists",
  "callback route exists",
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

await assertAuthMethodPlacement();
for (const filePath of implementationFiles) {
  if (!(await exists(filePath))) continue;
  const text = await readText(filePath);
  assertNoForbiddenRuntime(filePath, text);
}
await assertMissing(forbiddenPackageFiles, "package/dependency file");
await assertMissing(forbiddenEnvFiles, "env file");
await assertEnvExampleEmptyNamesOnly();

console.log("direct ui membrane provider login initiation ok");
