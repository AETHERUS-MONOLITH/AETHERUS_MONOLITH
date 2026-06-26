import fs from "node:fs/promises";

const recordPath = "data/direct-ui-membrane-protected-shell-birth-gate.v0.json";
const callbackRoutePath = "auth-callback.html";
const callbackScriptPath = "js/supabase-auth-callback.js";
const protectedShellPath = "protected-shell.html";
const protectedShellScriptPath = "js/supabase-protected-shell.js";
const loginUtilityPath = "js/supabase-login-initiation.js";
const callbackUtilityPath = "js/supabase-auth-precondition.js";
const loginSurfacePath = "auth-login.html";
const homepagePath = "index.html";
const envExamplePath = ".env.example";

const requiredTrueFlags = [
  "implementation_performed",
  "conditional_supabase_client_initialization_required",
  "auth_callback_precondition_required",
  "provider_login_initiation_required",
  "credential_flow_handling_started",
  "auth_callback_route_implemented",
  "auth_callback_utility_implemented",
  "provider_login_initiation_implemented",
  "session_detection_implemented",
  "protected_route_implemented",
  "protected_shell_entry_implemented",
  "authenticated_surfaces_birth_gate_implemented"
];

const requiredFalseFlags = [
  "credential_capture_implemented",
  "password_login_implemented",
  "signup_ui_implemented",
  "sign_up_implemented",
  "email_password_form_implemented",
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
  callbackRoutePath,
  callbackScriptPath,
  protectedShellPath,
  protectedShellScriptPath,
  loginUtilityPath,
  callbackUtilityPath,
  loginSurfacePath,
  "js/supabase-client.js"
];

const boundedAuthFiles = [
  loginUtilityPath,
  callbackUtilityPath,
  callbackScriptPath,
  protectedShellScriptPath
];

const allowedServerSecretFiles = new Set([
  recordPath,
  "scripts/validate-direct-ui-membrane-protected-shell-birth-gate.mjs",
  ".env.example"
]);

const serverSecretTerms = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "service_role",
  "jwt_secret"
];

const forbiddenImplementationPatterns = [
  { label: "password login", pattern: /\bsignInWithPassword\b/ },
  { label: "signup", pattern: /\bsignUp\b/ },
  { label: "database access", pattern: /\bsupabase\.from\b/ },
  { label: "localStorage", pattern: /\blocalStorage\b/ },
  { label: "sessionStorage", pattern: /\bsessionStorage\b/ },
  { label: "document.cookie", pattern: /\bdocument\.cookie\b/ },
  { label: "credential form", pattern: /<form\b/i },
  { label: "credential input", pattern: /<input\b/i },
  { label: "dashboard", pattern: /\bdashboard\b/i },
  { label: "account settings", pattern: /\baccount settings\b/i },
  { label: "billing page", pattern: /\bbilling page\b/i },
  { label: "team surface", pattern: /\bteam surface\b/i },
  { label: "tenant selector", pattern: /\btenant selector\b/i },
  { label: "customer workspace", pattern: /\bcustomer workspace\b/i },
  { label: "customer portal", pattern: /\bcustomer portal\b/i },
  { label: "monitoring dashboard", pattern: /\bmonitoring dashboard\b/i },
  { label: "compliance certified", pattern: /\bcompliance certified\b/i }
];

const protectedShellRequiredPhrases = [
  "Protected Shell Boundary",
  "Session recognized",
  "Authenticated save/load loop",
  "Session-scoped Supabase state",
  "Operational evidence pending",
  "Customer data outside scope",
  "Static evaluation mode",
  "Not a production SaaS interface",
  "Not an operational release system"
];

const loginSurfaceRequiredBoundaryPhrases = [
  "authenticated-surface entry",
  "Supabase/GitHub",
  "provider-backed access path",
  "Callback/session recognition",
  "guard admission",
  "production workspace is",
  "Browser-safe public config required",
  "Session recognition pending",
  "Static evaluation mode",
  "Not a production SaaS interface",
  "live model-execution claim"
];

const callbackRequiredBoundaryPhrases = [
  "Supabase/GitHub",
  "provider return",
  "session recognition",
  "does not load product records",
  "Callback/session recognition",
  "Guarded entry only after session",
  "Browser-safe route state",
  "Static evaluation mode",
  "Operational evidence pending",
  "Not a production SaaS interface",
  "Not an operational release system",
  "backend or product maturity"
];

const protectedShellMessagingRequiredPhrases = [
  "Protected shell admission depends on recognized Supabase session state",
  "Denial without a session is expected guard behavior",
  "production workspace is",
  "Expected denial without session",
  "guard admission plus a bounded save/load path",
  "Authenticated save/load loop",
  "Session-scoped Supabase state",
  "Operational evidence pending",
  "Customer data outside scope",
  "Static evaluation mode",
  "Not a production SaaS interface",
  "Not an operational release system"
];

const homepageForbiddenExposurePatterns = [
  { label: "backend claim", pattern: /\bbackend implemented\b/i },
  { label: "database claim", pattern: /\bdatabase implemented\b/i },
  { label: "application persistence claim", pattern: /\bapplication-data persistence\b/i },
  { label: "RLS claim", pattern: /\bRLS implemented\b/i },
  { label: "tenant isolation claim", pattern: /\btenant isolation implemented\b/i },
  { label: "billing claim", pattern: /\bbilling implemented\b/i },
  { label: "compliance readiness", pattern: /\bcompliance readiness\b/i },
  { label: "customer deployment readiness", pattern: /\bcustomer deployment readiness\b/i },
  { label: "public NEXUS runtime", pattern: /\bpublic NEXUS runtime\b/i },
  { label: "model API execution", pattern: /\bmodel API execution\b/i },
  { label: "monitoring dashboard", pattern: /\bmonitoring dashboard\b/i },
  { label: "production authentication claim", pattern: /\bproduction authentication\b/i },
  { label: "MFA completion claim", pattern: /\bMFA\b/i },
  { label: "mock session", pattern: /\bmock session\b/i },
  { label: "fake session", pattern: /\bfake session\b/i },
  { label: "stub session", pattern: /\bstub session\b/i },
  { label: "local storage manipulation", pattern: /\blocalStorage\b/ },
  { label: "session storage manipulation", pattern: /\bsessionStorage\b/ },
  { label: "cookie session handling", pattern: /\bdocument\.cookie\b/ },
  { label: "credential form", pattern: /<form\b/i },
  { label: "credential input", pattern: /<input\b/i }
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

function assertNoForbiddenImplementation(filePath, text) {
  for (const { label, pattern } of forbiddenImplementationPatterns) {
    if (pattern.test(text)) fail(`${filePath} contains forbidden ${label}`);
  }
  for (const term of serverSecretTerms) {
    if (text.includes(term)) fail(`${filePath} contains server-secret term ${term}`);
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

async function assertServerSecretTermsBounded() {
  const paths = (await fs.readdir(".", { recursive: true }))
    .filter((path) => typeof path === "string")
    .filter((path) => !path.startsWith(".git/"));

  for (const filePath of paths) {
    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    const text = await readText(filePath).catch(() => "");
    for (const term of serverSecretTerms) {
      if (!text.includes(term)) continue;
      if (
        !filePath.startsWith("scripts/") &&
        !filePath.startsWith("data/") &&
        !allowedServerSecretFiles.has(filePath)
      ) {
        fail(`${filePath} contains unbounded server-secret term ${term}`);
      }
    }
  }
}

async function assertAuthMethodPlacement() {
  const loginText = await readText(loginUtilityPath);
  const callbackUtilityText = await readText(callbackUtilityPath);
  const callbackScriptText = await readText(callbackScriptPath);
  const shellScriptText = await readText(protectedShellScriptPath);

  if (!/clientResult\.client\.auth\.signInWithOAuth\(\{/.test(loginText)) {
    fail("signInWithOAuth must remain in the bounded provider-login utility");
  }
  if (loginText.includes("exchangeCodeForSession") || loginText.includes("getSession")) {
    fail(`${loginUtilityPath} must not perform callback exchange or session classification`);
  }
  if (!/clientResult\.client\.auth\.exchangeCodeForSession\(code\)/.test(callbackUtilityText)) {
    fail("exchangeCodeForSession must remain in bounded callback handling");
  }
  if (!/clientResult\.client\.auth\.getSession\(\)/.test(callbackUtilityText)) {
    fail("getSession must remain in bounded session guard classification");
  }
  if (!callbackScriptText.includes("handleSupabaseAuthCallbackPrecondition")) {
    fail(`${callbackScriptPath} must call the bounded callback utility`);
  }
  if (!shellScriptText.includes("classifySupabaseSessionGuardPrecondition")) {
    fail(`${protectedShellScriptPath} must call the bounded session guard utility`);
  }

  for (const filePath of implementationFiles) {
    const text = await readText(filePath);
    if (text.includes("supabase.auth") && !boundedAuthFiles.includes(filePath)) {
      fail(`${filePath} uses supabase.auth outside bounded auth context`);
    }
  }
}

function assertBirthEvidence(record) {
  const evidence = record.birth_gate_evidence || {};
  assertIncludesAll(Object.keys(evidence), [
    "provider_login_initiation_path",
    "callback_session_recognition_path",
    "protected_route_admission_path",
    "protected_shell_entry_path",
    "implementation_pieces_present",
    "birth_claimed_reason",
    "live_verification_record",
    "live_verification_result"
  ], "birth_gate_evidence");
  assertIncludesAll(evidence.implementation_pieces_present || [], [
    "bounded provider login initiation exists",
    "bounded auth callback route exists",
    "bounded protected shell route exists",
    "bounded protected shell script exists"
  ], "birth_gate_evidence.implementation_pieces_present");
  if (!evidence.birth_claimed_reason.includes("real Supabase session")) {
    fail("birth_claimed_reason must name real Supabase session recognition");
  }
  if (evidence.live_verification_record !== "data/direct-ui-membrane-live-provider-loop-verification.v0.json") {
    fail("live_verification_record mismatch");
  }
  const live = evidence.live_verification_result || {};
  for (const flag of [
    "provider_login_initiation_verified",
    "github_oauth_provider_reached",
    "callback_session_recognition_verified",
    "protected_shell_admission_verified",
    "protected_shell_denial_without_session_verified"
  ]) {
    if (live[flag] !== true) fail(`birth_gate_evidence.live_verification_result.${flag} must be true`);
  }
  for (const flag of [
    "mock_stub_fake_session_used",
    "local_storage_session_storage_manipulation_used",
    "oauth_token_session_callback_user_payload_exposed"
  ]) {
    if (live[flag] !== false) fail(`birth_gate_evidence.live_verification_result.${flag} must be false`);
  }
}

function assertMessagingRecord(record) {
  const messaging = record.authenticated_surface_boundary_messaging || {};
  assertIncludesAll(Object.keys(messaging), [
    "messaging_hardened",
    "files_covered",
    "provider_backed_access_path_named",
    "supabase_github_provider_initiation_named",
    "callback_session_recognition_named",
    "protected_shell_guard_admission_named",
    "denial_without_session_framed_as_expected_guard_behavior",
    "birth_claim_expanded",
    "new_auth_capability_added",
    "backend_implemented",
    "database_schema_implemented",
    "application_data_persistence_implemented",
    "rls_implemented",
    "tenant_isolation_implemented",
    "customer_workspace_implemented",
    "billing_implemented",
    "monitoring_dashboard_implemented",
    "public_nexus_runtime_implemented",
    "model_api_execution_implemented",
    "production_saas_claimed"
  ], "authenticated_surface_boundary_messaging");
  assertIncludesAll(messaging.files_covered || [], [
    "auth-login.html",
    "auth-callback.html",
    "protected-shell.html",
    "js/supabase-protected-shell.js"
  ], "authenticated_surface_boundary_messaging.files_covered");
  for (const flag of [
    "messaging_hardened",
    "provider_backed_access_path_named",
    "supabase_github_provider_initiation_named",
    "callback_session_recognition_named",
    "protected_shell_guard_admission_named",
    "denial_without_session_framed_as_expected_guard_behavior"
  ]) {
    if (messaging[flag] !== true) fail(`authenticated_surface_boundary_messaging.${flag} must be true`);
  }
  for (const flag of [
    "birth_claim_expanded",
    "new_auth_capability_added",
    "backend_implemented",
    "database_schema_implemented",
    "application_data_persistence_implemented",
    "rls_implemented",
    "tenant_isolation_implemented",
    "customer_workspace_implemented",
    "billing_implemented",
    "monitoring_dashboard_implemented",
    "public_nexus_runtime_implemented",
    "model_api_execution_implemented",
    "production_saas_claimed"
  ]) {
    if (messaging[flag] !== false) fail(`authenticated_surface_boundary_messaging.${flag} must be false`);
  }
}

async function assertAuthenticatedPathBoundaryMessaging() {
  const loginText = await readText(loginSurfacePath);
  const callbackText = await readText(callbackRoutePath);
  const protectedShellText = await readText(protectedShellPath);
  const protectedShellScriptText = await readText(protectedShellScriptPath);

  assertIncludesAll(loginText, loginSurfaceRequiredBoundaryPhrases, loginSurfacePath);
  assertIncludesAll(callbackText, callbackRequiredBoundaryPhrases, callbackRoutePath);
  assertIncludesAll(protectedShellText, protectedShellMessagingRequiredPhrases, protectedShellPath);
  assertIncludesAll(protectedShellScriptText, [
    "Expected guard denial: session not recognized",
    "Guard denial expected"
  ], protectedShellScriptPath);
}

async function assertHomepageNavigationExposure(record) {
  const exposure = record.public_homepage_navigation_exposure || {};
  const requiredExposureKeys = [
    "exposure_implemented",
    "homepage_file",
    "exposed_route",
    "visible_link_label",
    "supporting_copy",
    "exposure_scope",
    "birth_claim_expanded",
    "provider_initiation_behavior_changed",
    "callback_session_behavior_changed",
    "protected_shell_behavior_changed"
  ];
  assertIncludesAll(Object.keys(exposure), requiredExposureKeys, "public_homepage_navigation_exposure");

  if (exposure.exposure_implemented !== true) fail("homepage navigation exposure must be implemented");
  if (exposure.homepage_file !== homepagePath) fail("homepage navigation exposure must name index.html");
  if (exposure.exposed_route !== loginSurfacePath) fail("homepage navigation exposure must point to auth-login.html");
  if (exposure.visible_link_label !== "Authenticated Surface") {
    fail("homepage navigation exposure visible link label mismatch");
  }
  if (exposure.birth_claim_expanded !== false) fail("homepage navigation must not expand the birth claim");

  for (const flag of [
    "provider_initiation_behavior_changed",
    "callback_session_behavior_changed",
    "protected_shell_behavior_changed",
    "authenticated_workspace_implemented",
    "backend_implemented",
    "database_schema_implemented",
    "persistence_implemented",
    "rls_implemented",
    "tenant_isolation_implemented",
    "customer_workspace_implemented",
    "billing_implemented",
    "production_saas_claimed"
  ]) {
    if (exposure[flag] !== false) fail(`public_homepage_navigation_exposure.${flag} must be false`);
  }

  const homepageText = await readText(homepagePath);
  const routePattern = new RegExp(`<a\\b[^>]*href=["']${loginSurfacePath.replace(".", "\\.")}["'][^>]*>\\s*${exposure.visible_link_label}\\s*</a>`, "i");
  if (!routePattern.test(homepageText)) {
    fail(`${homepagePath} must expose a visible ${exposure.visible_link_label} link to ${loginSurfacePath}`);
  }
  if (!homepageText.includes("Provider-backed access path")) {
    fail(`${homepagePath} must describe the provider-backed access path boundary`);
  }
  if (!homepageText.includes("authenticated-surface entry and provider initiation only")) {
    fail(`${homepagePath} must bound the exposed path to authenticated-surface entry and provider initiation`);
  }
  if (!homepageText.includes("not a production SaaS interface or customer workspace")) {
    fail(`${homepagePath} must deny production SaaS interface/customer workspace implications`);
  }

  for (const { label, pattern } of homepageForbiddenExposurePatterns) {
    if (pattern.test(homepageText)) fail(`${homepagePath} contains forbidden homepage exposure copy or behavior: ${label}`);
  }
}

if (!(await exists(recordPath))) fail(`${recordPath} is missing`);
for (const filePath of implementationFiles) {
  if (!(await exists(filePath))) fail(`${filePath} is missing`);
}

const record = await readJson(recordPath);
if (record.schema_version !== "0.1") fail("schema_version must be 0.1");
if (
  record.generated_for_sub_pass !==
  "§1.2 Supabase Implementation 0.6 — Protected Shell Entry / Authenticated Surfaces Birth Gate"
) {
  fail("generated_for_sub_pass mismatch");
}
if (record.baseline_commit !== "a8a80d535356197a326250bc0935fddaad6dbe99") {
  fail("baseline_commit mismatch");
}
if (record.object_status !== "protected_shell_entry_birth_gate") fail("object_status mismatch");
if (
  record.authenticated_surfaces_birth_verification !==
  "verified_real_provider_callback_and_protected_shell_admission_after_auth_storage"
) {
  fail("authenticated_surfaces_birth_verification mismatch");
}
if (record.authenticated_surfaces_born !== true) {
  fail(`${recordPath}.authenticated_surfaces_born must be true`);
}

assertRecordFlags(record);
assertMessagingRecord(record);
assertIncludesAll(record.permitted_supabase_auth_methods || [], [
  "signInWithOAuth",
  "exchangeCodeForSession",
  "getSession"
], "permitted_supabase_auth_methods");
assertBirthEvidence(record);
await assertHomepageNavigationExposure(record);
assertIncludesAll(record.claimable_after_this_pass || [], [
  "§1.2.3 Authenticated Surfaces are born only for the bounded callback/session recognition and protected-shell admission threshold verified through the real deployed GitHub OAuth and Supabase callback flow.",
  "A bounded protected-shell birth gate exists, and protected-shell admission is verified through Supabase session guard state."
], "claimable_after_this_pass");
assertIncludesAll(record.not_claimable_after_this_pass || [], [
  "password login exists",
  "signup exists",
  "credential capture exists",
  "backend exists",
  "database exists",
  "database-backed workspace exists",
  "persistence layer exists",
  "RLS exists",
  "tenant isolation exists",
  "customer workspace exists",
  "billing exists",
  "production SaaS exists",
  "compliance/customer deployment exists"
], "not_claimable_after_this_pass");

for (const filePath of implementationFiles) {
  const text = await readText(filePath);
  assertNoForbiddenImplementation(filePath, text);
}

const protectedShellText = await readText(protectedShellPath);
assertIncludesAll(protectedShellText, protectedShellRequiredPhrases, protectedShellPath);
await assertAuthenticatedPathBoundaryMessaging();
const protectedShellScriptText = await readText(protectedShellScriptPath);
if (!protectedShellScriptText.includes("guard_denied === false")) {
  fail(`${protectedShellScriptPath} must admit only after guard permits`);
}
if (!protectedShellScriptText.includes("session_present === true")) {
  fail(`${protectedShellScriptPath} must admit only after session recognition`);
}
const callbackScriptText = await readText(callbackScriptPath);
if (!callbackScriptText.includes("session_present === true")) {
  fail(`${callbackScriptPath} must reveal shell entry only after session recognition`);
}

await assertAuthMethodPlacement();
await assertMissing(forbiddenPackageFiles, "package/dependency file");
await assertMissing(forbiddenEnvFiles, "env file");
await assertEnvExampleEmptyNamesOnly();
await assertServerSecretTermsBounded();

console.log("direct ui membrane protected shell birth gate ok (live birth threshold verified)");
